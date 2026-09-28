import React, { useEffect, useRef } from 'react';
import { Animated, AppState, StyleSheet, View } from 'react-native';

// Randomized interval between possible strikes, per explicit request — never a fixed repeating
// loop.
const MIN_INTERVAL_MS = 3000;
const MAX_INTERVAL_MS = 12000;
// The flash sequence itself: a very subtle pre-flash, the bright flash, a slight secondary flash,
// then back to normal storm darkness — see FULL_SEQUENCE/REDUCED_SEQUENCE below for the actual
// opacity values each step animates to.
const PRE_FLASH_MS = 90;
const PRE_FLASH_HOLD_MS = 70;
const MAIN_FLASH_MS = 70;
const MAIN_HOLD_MS = 90;
const FADE_MS = 160;
const SECONDARY_FLASH_MS = 70;
const SECONDARY_HOLD_MS = 70;
const SECONDARY_FADE_MS = 220;

// Never an aggressive full-white screen flash (per explicit request it "could hurt the user's
// eyes") — even the "full" sequence caps well under full opacity, and reducedFlashing caps it much
// further still, closer to a brightness change than a flash.
const FULL_SEQUENCE = { pre: 0.1, main: 0.55, secondary: 0.22 };
const REDUCED_SEQUENCE = { pre: 0.04, main: 0.16, secondary: 0.07 };

interface LightningControllerProps {
  active: boolean;
  /** Throw Settings' own "Reduce Flashing" toggle — caps every flash to a much subtler brightness
   * change instead of a bright one (see REDUCED_SEQUENCE), independent of the OS reduce-motion
   * setting below. */
  reducedFlashing: boolean;
  /** The OS accessibility "reduce motion" preference (see useReducedMotion) — when on, lightning
   * never schedules or plays a flash at all, the more conservative of the two controls. */
  reduceMotion: boolean;
}

/**
 * Schedules and plays randomized lightning flashes — a single `Animated.View` whose opacity
 * animates through the pre-flash/flash/secondary-flash/fade sequence on each strike, driven by one
 * `setTimeout`-based random scheduler (see scheduleNext below), not a fixed repeating animation.
 * Reused as-is by both 'thunderstorm' (over active rain/clouds) and the standalone 'lightning'
 * condition (over just clouds) — WeatherOverlay is what decides which other renderers accompany it.
 */
export function LightningController({ active, reducedFlashing, reduceMotion }: LightningControllerProps) {
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    if (!active || reduceMotion) {
      clearTimer();
      flashOpacity.setValue(0);
      return clearTimer;
    }

    const sequence = reducedFlashing ? REDUCED_SEQUENCE : FULL_SEQUENCE;
    const strike = () => {
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: sequence.pre, duration: PRE_FLASH_MS, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0, duration: PRE_FLASH_HOLD_MS, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: sequence.main, duration: MAIN_FLASH_MS, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: sequence.main * 0.35, duration: MAIN_HOLD_MS, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: sequence.secondary, duration: SECONDARY_FLASH_MS, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: sequence.secondary * 0.3, duration: SECONDARY_HOLD_MS, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0, duration: SECONDARY_FADE_MS, useNativeDriver: true }),
      ]).start();
      scheduleNext();
    };
    const scheduleNext = () => {
      clearTimer();
      if (pausedRef.current) return;
      const delay = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
      timerRef.current = setTimeout(strike, delay);
    };
    scheduleNext();
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reducedFlashing, reduceMotion]);

  // Pauses the random scheduler while the app is backgrounded — resumes with a fresh random delay
  // once foregrounded, rather than firing an overdue strike the instant the app returns.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      pausedRef.current = state !== 'active';
      if (timerRef.current && pausedRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flashOpacity }]} />
  );
}

const styles = StyleSheet.create({
  // A cool blue-white rather than pure white — reads as an actual lightning flash instead of the
  // screen simply going bright.
  flash: { backgroundColor: '#E8EEFF' },
});
