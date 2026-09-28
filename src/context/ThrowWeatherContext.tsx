import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useThrow } from './ThrowContext';
import { getCurrentWeather, normalizeWeatherCondition } from '../services/weatherService';
import type { ThrowWeatherState, WeatherCondition, WeatherMode } from '../types/weather';

// Don't re-hit the weather API more than this often for the same location — see the refresh
// effect's own comment for the other two things that *do* still trigger an early refresh
// (location actually changing, or a caller asking for one explicitly via `refresh`).
const CACHE_TTL_MS = 20 * 60 * 1000;
// A failed fetch still shouldn't be retried on every render/relocation blip — this is deliberately
// much shorter than CACHE_TTL_MS, just enough to stop a retry storm if e.g. the device is briefly
// offline.
const RETRY_COOLDOWN_MS = 60 * 1000;

function roundedLocationKey(lat: number, lng: number): string {
  // ~1km precision — plenty for "did the user's Throw location actually change" without a cache
  // miss from float noise/re-saving the exact same city.
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

interface ThrowWeatherContextValue extends ThrowWeatherState {
  setMode: (mode: WeatherMode) => void;
  /** Only 'clear' (off) or 'rain' is actually selectable from Settings today — see
   * ThrowWeatherState.manualCondition's own doc comment for why the type stays the full union. */
  setManualCondition: (condition: WeatherCondition) => void;
  /** Re-fetches now regardless of the cache — wired to a manual "Refresh" affordance if/when
   * Settings grows one; automatic mode's own effect already covers the ordinary cases (screen
   * opens, location changes, cache expires) without this ever needing to be called from there. */
  refresh: () => void;
}

const ThrowWeatherContext = createContext<ThrowWeatherContextValue | null>(null);

/**
 * The "WeatherController" between Throw's own location/settings and WeatherOverlay — owns the one
 * shared `mode`/`manualCondition` preference (persisted to `user_settings`, same upsert-per-column
 * pattern ThrowColorModeContext already uses) and, in automatic mode, when to actually ask
 * WeatherService for a fresh reading. WeatherOverlay only ever reads the resulting `weather`/
 * `intensity` off this context — it has no idea whether that came from a real API call or a manual
 * override, which is the whole point (see this file's own architecture comment in weatherService.ts).
 */
export function ThrowWeatherProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const { myLocation } = useThrow();

  const [mode, setModeState] = useState<WeatherMode>('automatic');
  const [manualCondition, setManualConditionState] = useState<WeatherCondition>('clear');
  const [autoWeather, setAutoWeather] = useState<WeatherCondition>('clear');
  const [autoIntensity, setAutoIntensity] = useState<ThrowWeatherState['intensity']>('medium');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | undefined>(undefined);

  const lastFetchedLocationKeyRef = useRef<string | null>(null);
  const lastAttemptAtRef = useRef(0);
  const requestIdRef = useRef(0);

  // Loads the saved preference once a user is known — same "no user yet, stay at the default"
  // shape as ThrowColorModeContext's own load effect.
  useEffect(() => {
    if (!userId) {
      setModeState('automatic');
      setManualConditionState('clear');
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('user_settings').select('throw_weather_mode, throw_weather_manual_condition').eq('user_id', userId).maybeSingle();
      if (cancelled) return;
      setModeState((data?.throw_weather_mode as WeatherMode | undefined) ?? 'automatic');
      setManualConditionState((data?.throw_weather_manual_condition as WeatherCondition | undefined) ?? 'clear');
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setMode = useCallback(
    (next: WeatherMode) => {
      setModeState(next);
      if (!userId) return;
      supabase
        .from('user_settings')
        .upsert({ user_id: userId, throw_weather_mode: next }, { onConflict: 'user_id' })
        .then(({ error }) => {
          if (error) console.warn('[ThrowWeather] failed to save mode:', error.message);
        });
    },
    [userId],
  );

  const setManualCondition = useCallback(
    (next: WeatherCondition) => {
      setManualConditionState(next);
      if (!userId) return;
      supabase
        .from('user_settings')
        .upsert({ user_id: userId, throw_weather_manual_condition: next }, { onConflict: 'user_id' })
        .then(({ error }) => {
          if (error) console.warn('[ThrowWeather] failed to save manual condition:', error.message);
        });
    },
    [userId],
  );

  const runFetch = useCallback(async (latitude: number, longitude: number) => {
    const requestId = ++requestIdRef.current;
    lastAttemptAtRef.current = Date.now();
    setIsLoading(true);
    const raw = await getCurrentWeather(latitude, longitude);
    // A newer request (a later location, or an explicit refresh) started while this one was in
    // flight — let that one's own result win instead of an older response clobbering it.
    if (requestId !== requestIdRef.current) return;
    setIsLoading(false);
    if (!raw) {
      // Weather API failure (#14 in the feature request) — fall back to the normal map rather than
      // surfacing an error; leaving autoWeather/autoIntensity exactly as they already were (whatever
      // the last good reading was, or the 'clear' default) is exactly that fallback.
      return;
    }
    const normalized = normalizeWeatherCondition(raw);
    setAutoWeather(normalized.condition);
    setAutoIntensity(normalized.intensity);
    setLastUpdated(Date.now());
    lastFetchedLocationKeyRef.current = roundedLocationKey(latitude, longitude);
  }, []);

  // Automatic-mode refresh — fires when the Throw screen (this provider) mounts, when the relevant
  // location actually changes, or when the cached reading has expired; never on a plain timer, per
  // explicit request not to poll the weather API continuously.
  useEffect(() => {
    if (mode !== 'automatic' || !myLocation) return;
    const key = roundedLocationKey(myLocation.latitude, myLocation.longitude);
    const locationChanged = key !== lastFetchedLocationKeyRef.current;
    const cacheExpired = lastUpdated == null || Date.now() - lastUpdated > CACHE_TTL_MS;
    if (!locationChanged && !cacheExpired) return;
    if (Date.now() - lastAttemptAtRef.current < RETRY_COOLDOWN_MS) return;
    runFetch(myLocation.latitude, myLocation.longitude);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, myLocation?.latitude, myLocation?.longitude, lastUpdated, runFetch]);

  const refresh = useCallback(() => {
    if (mode !== 'automatic' || !myLocation) return;
    runFetch(myLocation.latitude, myLocation.longitude);
  }, [mode, myLocation, runFetch]);

  // What's actually active — automatic mode's own latest reading, or the manual override verbatim.
  // Automatic never falls back to a stale manual pick (see ThrowWeatherState.manualCondition's own
  // doc comment) even if one exists from an earlier session.
  const weather = mode === 'manual' ? manualCondition : autoWeather;
  const intensity = mode === 'manual' ? 'medium' : autoIntensity;

  const value = useMemo(
    () => ({
      mode,
      manualCondition,
      weather,
      intensity,
      isLoading: mode === 'automatic' && isLoading,
      lastUpdated,
      setMode,
      setManualCondition,
      refresh,
    }),
    [mode, manualCondition, weather, intensity, isLoading, lastUpdated, setMode, setManualCondition, refresh],
  );

  return <ThrowWeatherContext.Provider value={value}>{children}</ThrowWeatherContext.Provider>;
}

export function useThrowWeather(): ThrowWeatherContextValue {
  const ctx = useContext(ThrowWeatherContext);
  if (!ctx) throw new Error('useThrowWeather must be used within a ThrowWeatherProvider');
  return ctx;
}
