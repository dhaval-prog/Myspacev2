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
   * own paper/plane read this; everything else in Throw (the map, the recipient carousel) keeps
   * following the viewer's actual clock unconditionally — see autoIsDay. */
  isDay: boolean;
  /** The viewer's own device clock, unaffected by `mode` — what every Throw map and the recipient
   * carousel render with, regardless of the paper/plane color the user has picked. */
  autoIsDay: boolean;
  setMode: (mode: ThrowColorMode) => void;
}

const ThrowColorModeContext = createContext<ThrowColorModeContextValue | null>(null);

/**
 * Loads the signed-in user's paper/plane color preference (`user_settings.throw_color_mode`) and
 * derives two signals from it: `isDay` (what the preference actually resolves to — only the
 * letter's own paper/plane read this) and `autoIsDay` (the viewer's own device clock, always, for
 * everything else in Throw — the map, the recipient carousel — per explicit request that this
 * setting affect the letter alone, not the rest of Throw's day/night behavior). Both used to be
 * separate isDaytimeNow-polling useState/effects duplicated across ThrowHomeScreen and both
 * ThrowMap platforms; this context is the one shared computation. Defaults to 'auto' (the
 * pre-existing automatic day/night switching) whenever there's no signed-in user yet or no
 * override has been saved.
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

  const value = useMemo(() => ({ mode, isDay, autoIsDay, setMode }), [mode, isDay, autoIsDay]);
  return <ThrowColorModeContext.Provider value={value}>{children}</ThrowColorModeContext.Provider>;
}

export function useThrowColorMode(): ThrowColorModeContextValue {
  const ctx = useContext(ThrowColorModeContext);
  if (!ctx) throw new Error('useThrowColorMode must be used within a ThrowColorModeProvider');
  return ctx;
}
