import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { colors, EASE, fontFamily } from '../theme';
import { useReducedMotion } from '../hooks/useReducedMotion';

/** Matches the reference's own spec exactly: "Total run 1.75s, then the app fades in." */
const RUN_DURATION = 1750;
const FADE_DURATION = 350;

// The Lottie composition's own pixel space (1080×2340) — everything below
// is positioned as a fraction of it, then mapped onto the actual screen
// with the same "cover" scale/crop the LottieView itself uses, so the
// text overlay lines up with where the composition places it regardless
// of device size.
const COMP_W = 1080;
const COMP_H = 2340;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const COVER_SCALE = Math.max(SCREEN_W / COMP_W, SCREEN_H / COMP_H);
const OFFSET_X = (SCREEN_W - COMP_W * COVER_SCALE) / 2;
const OFFSET_Y = (SCREEN_H - COMP_H * COVER_SCALE) / 2;
const toScreenX = (x: number) => OFFSET_X + x * COVER_SCALE;
const toScreenY = (y: number) => OFFSET_Y + y * COVER_SCALE;

/**
 * The Lottie's own "wordmark"/"tagline" text layers name Figtree/DM Mono
 * by font family, which the native Lottie renderer resolves against the
 * OS font table — not the app's own Expo-loaded fonts, which only React
 * Native's Text component can see. Since those exact names aren't
 * registered natively, the layers render nothing at all rather than a
 * substitute font. Reproduced here as real Text instead (using the same
 * fonts, already loaded before this ever mounts), positioned and timed
 * from the JSON's own keyframes (frame 30–39 for the wordmark, 40–49 for
 * the tagline, both at 30fps) so they land exactly where — and when —
 * the composition places them.
 */
const WORDMARK_START_MS = 1000;
const WORDMARK_DURATION_MS = 300;
const TAGLINE_START_MS = 1333;
const TAGLINE_DURATION_MS = 300;

interface LaunchIntroProps {
  onDone: () => void;
}

/**
 * The one-time animated intro shown the instant the native launch screen
 * hands off to JS: plays the exact reference Lottie file (design ref 6n2,
 * "Launch screen · final · the roof lands on the m") — the `m` springs up
 * from the baseline, the roof drops and settles onto its shoulders — over
 * the real app underneath, then fades to reveal it. Respects reduce-motion
 * by skipping straight to the finished static mark instead of playing the
 * animation (per the reference's own spec: "Static fallback: lime
 * background with the finished mark, no wordmark").
 */
export function LaunchIntro({ onDone }: LaunchIntroProps) {
  const reduceMotion = useReducedMotion();
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const wordmarkProgress = useRef(new Animated.Value(0)).current;
  const taglineProgress = useRef(new Animated.Value(0)).current;
  // `onDone` is an inline closure at the call site (App.tsx), so a fresh
  // reference lands on every one of App's re-renders — depending on it
  // directly would re-run this effect mid-sequence, wiping the pending
  // timers and restarting the fade before it ever completes. A ref lets
  // the effect below run exactly once.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const finish = () => {
      if (cancelled) return;
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: FADE_DURATION,
        easing: EASE,
        useNativeDriver: true,
      }).start(() => {
        if (!cancelled) onDoneRef.current();
      });
    };

    if (reduceMotion) {
      timers.push(setTimeout(finish, 500));
      return () => {
        cancelled = true;
        timers.forEach(clearTimeout);
      };
    }

    timers.push(
      setTimeout(() => {
        Animated.timing(wordmarkProgress, { toValue: 1, duration: WORDMARK_DURATION_MS, easing: EASE, useNativeDriver: true }).start();
      }, WORDMARK_START_MS),
    );
    timers.push(
      setTimeout(() => {
        Animated.timing(taglineProgress, { toValue: 1, duration: TAGLINE_DURATION_MS, easing: EASE, useNativeDriver: true }).start();
      }, TAGLINE_START_MS),
    );
    timers.push(setTimeout(finish, RUN_DURATION));

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [reduceMotion, overlayOpacity, wordmarkProgress, taglineProgress]);

  const wordmarkTranslateY = wordmarkProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [toScreenY(1334) - toScreenY(1300), 0],
  });
  const taglineTranslateY = taglineProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [toScreenY(1464) - toScreenY(1430), 0],
  });

  return (
    <Animated.View style={[styles.fill, { opacity: overlayOpacity }]} pointerEvents="none">
      {reduceMotion ? (
        <Image source={require('../../assets/splash-icon.png')} style={styles.staticMark} resizeMode="contain" />
      ) : (
        <>
          <LottieView
            source={require('../../assets/lottie/launch-intro.json')}
            autoPlay
            loop={false}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
          />
          <Animated.Text
            style={[
              styles.wordmark,
              {
                top: toScreenY(1300) - (138 * COVER_SCALE) / 2,
                opacity: wordmarkProgress,
                transform: [{ translateY: wordmarkTranslateY }],
              },
            ]}
          >
            myspace
          </Animated.Text>
          <Animated.Text
            style={[
              styles.tagline,
              {
                top: toScreenY(1430) - (40.8 * COVER_SCALE) / 2,
                opacity: taglineProgress,
                transform: [{ translateY: taglineTranslateY }],
              },
            ]}
          >
            OWN · OWE · SAVE
          </Animated.Text>
        </>
      )}
    </Animated.View>
  );
}

const wordmarkFontSize = 115 * COVER_SCALE;
const taglineFontSize = 34 * COVER_SCALE;

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
  wordmark: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fontFamily.sans800,
    fontSize: wordmarkFontSize,
    letterSpacing: wordmarkFontSize * -0.04,
    color: colors.ink,
  },
  tagline: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fontFamily.mono500,
    fontSize: taglineFontSize,
    letterSpacing: taglineFontSize * 0.18,
    color: colors.ink,
  },
});
