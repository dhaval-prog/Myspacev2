import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { colors, EASE } from '../theme';
import { useReducedMotion } from '../hooks/useReducedMotion';

/** Matches the reference's own spec exactly: "Total run 1.75s, then the app fades in." */
const RUN_DURATION = 1750;
const FADE_DURATION = 350;

interface LaunchIntroProps {
  onDone: () => void;
}

/**
 * The one-time animated intro shown the instant the native launch screen
 * hands off to JS: plays the exact reference Lottie file (design ref 6n2,
 * "Launch screen · final · the roof lands on the m") — the `m` springs up
 * from the baseline, the roof drops and settles onto its shoulders, the
 * wordmark and tagline follow — over the real app underneath, then fades
 * to reveal it. Respects reduce-motion by skipping straight to the
 * finished static mark instead of playing the animation.
 */
export function LaunchIntro({ onDone }: LaunchIntroProps) {
  const reduceMotion = useReducedMotion();
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  // `onDone` is an inline closure at the call site (App.tsx), so a fresh
  // reference lands on every one of App's re-renders — depending on it
  // directly would re-run this effect mid-sequence, wiping the pending
  // timer and restarting the fade before it ever completes. A ref lets
  // the effect below run exactly once.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(
      () => {
        if (cancelled) return;
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: FADE_DURATION,
          easing: EASE,
          useNativeDriver: true,
        }).start(() => {
          if (!cancelled) onDoneRef.current();
        });
      },
      reduceMotion ? 500 : RUN_DURATION,
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reduceMotion, overlayOpacity]);

  return (
    <Animated.View style={[styles.fill, { opacity: overlayOpacity }]} pointerEvents="none">
      {reduceMotion ? (
        <Image source={require('../../assets/splash-icon.png')} style={styles.staticMark} resizeMode="contain" />
      ) : (
        <LottieView
          source={require('../../assets/lottie/launch-intro.json')}
          autoPlay
          loop={false}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  staticMark: {
    width: 150,
    height: 150,
  },
});
