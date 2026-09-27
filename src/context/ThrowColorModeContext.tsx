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
  /** The day/night palette every Throw map and letter should actually render with — 'auto'
   * follows the viewer's own device clock (see isDaytimeNow), 'day'/'night' pin it regardless of
   * the time. */
  isDay: boolean;
  setMode: (mode: ThrowColorMode) => void;
}

const ThrowColorModeContext = createContext<ThrowColorModeContextValue | null>(null);

/**
 * Loads the signed-in user's Throw color-mode preference (`user_settings.throw_color_mode`) and
 * derives the single `isDay` signal every Throw map/letter renders with — replacing what used to
 * be a separate isDaytimeNow-polling useState/effect duplicated in ThrowHomeScreen and both
 * ThrowMap platforms. Defaults to 'auto' (the pre-existing automatic day/night switching)
 * whenever there's no signed-in user yet or no override has been saved.
 */
export function ThrowColorModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [mode, setModeState] = useState<ThrowColorMode>('auto');
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
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('user_settings').select('throw_color_mode').eq('user_id', userId).maybeSingle();
      if (!cancelled) setModeState((data?.throw_color_mode as ThrowColorMode | undefined) ?? 'auto');
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

  const isDay = mode === 'day' ? true : mode === 'night' ? false : autoIsDay;

  const value = useMemo(() => ({ mode, isDay, setMode }), [mode, isDay]);
  return <ThrowColorModeContext.Provider value={value}>{children}</ThrowColorModeContext.Provider>;
}

export function useThrowColorMode(): ThrowColorModeContextValue {
  const ctx = useContext(ThrowColorModeContext);
  if (!ctx) throw new Error('useThrowColorMode must be used within a ThrowColorModeProvider');
  return ctx;
}
