import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { isDaytimeNow } from '../utils/solarTime';

export type ThrowColorMode = 'auto' | 'day' | 'night';

// Same cadence every Throw map/letter already recomputed the viewer's own day/night signal on —
// kept here now that this context owns the one shared computation.
const DAYTIME_RECHECK_MS = 5 * 60 * 1000;

interface ThrowColorModeContextValue {
  mode: ThrowColorMode;
  /** The paper & plane color this setting resolves to — 'auto' follows the viewer's own device
   * clock (see isDaytimeNow), 'day'/'night' pin it regardless of the time. Only FoldingLetter's
   * own paper/plane read this. */
  isDay: boolean;
  /** The viewer's own device clock, unaffected by either `mode` below — the one shared "what time
   * is it really" signal both `isDay` and `mapIsDay` fall back to for their own 'auto' case. */
  autoIsDay: boolean;
  setMode: (mode: ThrowColorMode) => void;
  /** The map's own separate day/night/auto preference (`user_settings.throw_map_color_mode`) —
   * independent of `mode` above, per explicit request that the map's basemap style be
   * user-controllable the same way the letter's paper/plane color already is. */
  mapMode: ThrowColorMode;
  /** What `mapMode` resolves to — read by every ThrowMap (web/native) and the recipient carousel
   * overlaid on it, so the carousel's own skin always matches whatever style the map beneath it
   * is actually showing. */
  mapIsDay: boolean;
  setMapMode: (mode: ThrowColorMode) => void;
  /** Whether Throw's home screen shows the real live map (`user_settings.throw_map_show_background`)
   * instead of the lighter day/night glassmorphism backdrop — off by default since the live map
   * costs battery and data; an explicit opt-in via Throw Settings. */
  showMapBackground: boolean;
  setShowMapBackground: (show: boolean) => void;
}

const ThrowColorModeContext = createContext<ThrowColorModeContextValue | null>(null);

/**
 * Loads the signed-in user's two independent color preferences — the letter's own paper/plane
 * (`user_settings.throw_color_mode`) and the map's own basemap (`throw_map_color_mode`) — and
 * derives `isDay`/`mapIsDay` from each (falling back to `autoIsDay`, the viewer's own device
 * clock, for either's 'auto' case). Both used to be separate isDaytimeNow-polling useState/
 * effects duplicated across ThrowHomeScreen and both ThrowMap platforms; this context is the one
 * shared computation. Both default to 'auto' (the pre-existing automatic day/night switching)
 * whenever there's no signed-in user yet or no override has been saved.
 */
export function ThrowColorModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [mode, setModeState] = useState<ThrowColorMode>('auto');
  const [mapMode, setMapModeState] = useState<ThrowColorMode>('auto');
  const [showMapBackground, setShowMapBackgroundState] = useState(false);
  const [autoIsDay, setAutoIsDay] = useState(() => isDaytimeNow());

  useEffect(() => {
    const recompute = () => setAutoIsDay(isDaytimeNow());
    recompute();
    const interval = setInterval(recompute, DAYTIME_RECHECK_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!userId) {
      setModeState('auto');
      setMapModeState('auto');
      setShowMapBackgroundState(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('throw_color_mode, throw_map_color_mode, throw_map_show_background')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      setModeState((data?.throw_color_mode as ThrowColorMode | undefined) ?? 'auto');
      setMapModeState((data?.throw_map_color_mode as ThrowColorMode | undefined) ?? 'auto');
      setShowMapBackgroundState((data?.throw_map_show_background as boolean | undefined) ?? false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setMode = (next: ThrowColorMode) => {
    setModeState(next);
    if (!userId) return;
    supabase
      .from('user_settings')
      .upsert({ user_id: userId, throw_color_mode: next }, { onConflict: 'user_id' })
      .then(({ error }) => {
        if (error) console.warn('[ThrowColorMode] failed to save:', error.message);
      });
  };

  const setMapMode = (next: ThrowColorMode) => {
    setMapModeState(next);
    if (!userId) return;
    supabase
      .from('user_settings')
      .upsert({ user_id: userId, throw_map_color_mode: next }, { onConflict: 'user_id' })
      .then(({ error }) => {
        if (error) console.warn('[ThrowColorMode] failed to save map mode:', error.message);
      });
  };

  const setShowMapBackground = (next: boolean) => {
    setShowMapBackgroundState(next);
    if (!userId) return;
    supabase
      .from('user_settings')
      .upsert({ user_id: userId, throw_map_show_background: next }, { onConflict: 'user_id' })
      .then(({ error }) => {
        if (error) console.warn('[ThrowColorMode] failed to save show-map-background:', error.message);
      });
  };

  const isDay = mode === 'day' ? true : mode === 'night' ? false : autoIsDay;
  const mapIsDay = mapMode === 'day' ? true : mapMode === 'night' ? false : autoIsDay;

  const value = useMemo(
    () => ({ mode, isDay, autoIsDay, setMode, mapMode, mapIsDay, setMapMode, showMapBackground, setShowMapBackground }),
    [mode, isDay, autoIsDay, mapMode, mapIsDay, showMapBackground],
  );
  return <ThrowColorModeContext.Provider value={value}>{children}</ThrowColorModeContext.Provider>;
}

export function useThrowColorMode(): ThrowColorModeContextValue {
  const ctx = useContext(ThrowColorModeContext);
  if (!ctx) throw new Error('useThrowColorMode must be used within a ThrowColorModeProvider');
  return ctx;
}
