import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useThrow } from './ThrowContext';
import { getCurrentWeather, normalizeWeatherCondition } from '../services/weatherService';
import type { NormalizedWeather, ThrowWeatherState, WeatherCondition, WeatherIntensity, WeatherMode } from '../types/weather';

// Don't re-hit the weather API more than this often for the same location — see the refresh
// effect's own comment for the other two things that *do* still trigger an early refresh
// (location actually changing, or a caller asking for one explicitly via `refresh`).
const CACHE_TTL_MS = 20 * 60 * 1000;
// A failed fetch still shouldn't be retried on every render/relocation blip — this is deliberately
// much shorter than CACHE_TTL_MS, just enough to stop a retry storm if e.g. the device is briefly
// offline.
const RETRY_COOLDOWN_MS = 60 * 1000;
// Manual weather has no real reading to draw wind from — a fixed, unremarkable breeze so
// rain/snow/wind/cloud renderers still have *something* physically plausible to angle themselves
// by, rather than a suspiciously dead-still 0.
const MANUAL_WIND_SPEED_KPH = 16;
const MANUAL_WIND_DIRECTION_DEG = 205;

function roundedLocationKey(lat: number, lng: number): string {
  // ~1km precision — plenty for "did the user's Throw location actually change" without a cache
  // miss from float noise/re-saving the exact same city.
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

interface ThrowWeatherContextValue extends ThrowWeatherState {
  setMode: (mode: WeatherMode) => void;
  setManualCondition: (condition: WeatherCondition) => void;
  setManualIntensity: (intensity: WeatherIntensity) => void;
  setReducedFlashing: (reduced: boolean) => void;
  /** Re-fetches now regardless of the cache — wired to a manual "Refresh" affordance if/when
   * Settings grows one; automatic mode's own effect already covers the ordinary cases (screen
   * opens, location changes, cache expires) without this ever needing to be called from there. */
  refresh: () => void;
}

const ThrowWeatherContext = createContext<ThrowWeatherContextValue | null>(null);

/**
 * The "WeatherController" between Throw's own location/settings and WeatherOverlay — owns the one
 * shared mode/manualCondition/manualIntensity/reducedFlashing preference (persisted to
 * `user_settings`, same upsert-per-column pattern ThrowColorModeContext already uses) and, in
 * automatic mode, when to actually ask WeatherService for a fresh reading. WeatherOverlay only ever
 * reads the resulting `weather`/`intensity`/`windSpeedKph`/`windDirectionDeg` off this context — it
 * has no idea whether that came from a real API call or a manual override, which is the whole point
 * (see weatherService.ts's own architecture comment).
 */
export function ThrowWeatherProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const { myLocation } = useThrow();

  const [mode, setModeState] = useState<WeatherMode>('automatic');
  const [manualCondition, setManualConditionState] = useState<WeatherCondition>('clear');
  const [manualIntensity, setManualIntensityState] = useState<WeatherIntensity>('medium');
  const [reducedFlashing, setReducedFlashingState] = useState(false);
  const [autoWeather, setAutoWeather] = useState<NormalizedWeather | null>(null);
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
      setManualIntensityState('medium');
      setReducedFlashingState(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('throw_weather_mode, throw_weather_manual_condition, throw_weather_manual_intensity, throw_weather_reduced_flashing')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      setModeState((data?.throw_weather_mode as WeatherMode | undefined) ?? 'automatic');
      setManualConditionState((data?.throw_weather_manual_condition as WeatherCondition | undefined) ?? 'clear');
      setManualIntensityState((data?.throw_weather_manual_intensity as WeatherIntensity | undefined) ?? 'medium');
      setReducedFlashingState(data?.throw_weather_reduced_flashing ?? false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function persist(column: string, value: string | boolean, label: string) {
    if (!userId) return;
    supabase
      .from('user_settings')
      .upsert({ user_id: userId, [column]: value }, { onConflict: 'user_id' })
      .then(({ error }) => {
        if (error) console.warn(`[ThrowWeather] failed to save ${label}:`, error.message);
      });
  }

  const setMode = useCallback(
    (next: WeatherMode) => {
      setModeState(next);
      persist('throw_weather_mode', next, 'mode');
    },
    [userId],
  );
  const setManualCondition = useCallback(
    (next: WeatherCondition) => {
      setManualConditionState(next);
      persist('throw_weather_manual_condition', next, 'manual condition');
    },
    [userId],
  );
  const setManualIntensity = useCallback(
    (next: WeatherIntensity) => {
      setManualIntensityState(next);
      persist('throw_weather_manual_intensity', next, 'manual intensity');
    },
    [userId],
  );
  const setReducedFlashing = useCallback(
    (next: boolean) => {
      setReducedFlashingState(next);
      persist('throw_weather_reduced_flashing', next, 'reduced flashing');
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
      // Weather API failure — fall back to the normal map rather than surfacing an error; leaving
      // autoWeather exactly as it already was (whatever the last good reading was, or null/'clear'
      // by default) is exactly that fallback.
      return;
    }
    setAutoWeather(normalizeWeatherCondition(raw));
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
  // Automatic never falls back to a stale manual pick even if one exists from an earlier session
  // (see ThrowWeatherState.manualCondition's own doc comment); with no reading yet (still loading,
  // or the very first fetch hasn't landed), it stays 'clear' — the neutral state the feature's own
  // loading-state notes ask for, rather than a spinner or a guess.
  const weather = mode === 'manual' ? manualCondition : (autoWeather?.condition ?? 'clear');
  const intensity = mode === 'manual' ? manualIntensity : (autoWeather?.intensity ?? 'light');
  const windSpeedKph = mode === 'manual' ? MANUAL_WIND_SPEED_KPH : (autoWeather?.windSpeedKph ?? 0);
  const windDirectionDeg = mode === 'manual' ? MANUAL_WIND_DIRECTION_DEG : (autoWeather?.windDirectionDeg ?? 0);

  const value = useMemo(
    () => ({
      mode,
      manualCondition,
      manualIntensity,
      weather,
      intensity,
      windSpeedKph,
      windDirectionDeg,
      reducedFlashing,
      isLoading: mode === 'automatic' && isLoading,
      lastUpdated,
      setMode,
      setManualCondition,
      setManualIntensity,
      setReducedFlashing,
      refresh,
    }),
    [
      mode,
      manualCondition,
      manualIntensity,
      weather,
      intensity,
      windSpeedKph,
      windDirectionDeg,
      reducedFlashing,
      isLoading,
      lastUpdated,
      setMode,
      setManualCondition,
      setManualIntensity,
      setReducedFlashing,
      refresh,
    ],
  );

  return <ThrowWeatherContext.Provider value={value}>{children}</ThrowWeatherContext.Provider>;
}

export function useThrowWeather(): ThrowWeatherContextValue {
  const ctx = useContext(ThrowWeatherContext);
  if (!ctx) throw new Error('useThrowWeather must be used within a ThrowWeatherProvider');
  return ctx;
}
