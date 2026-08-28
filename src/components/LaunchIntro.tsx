import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, EASE, fontFamily } from '../theme';
import { useReducedMotion } from '../hooks/useReducedMotion';

const ROOF_PATH = 'M14 40 50 12l36 28';
const MARK_WIDTH = 120;
const ROOF_HEIGHT = 46;
/** Matches the native (static) launch screen's finished mark exactly — this plays its origin story, then hands off. */
const RUN_DURATION = 1750;
const FADE_DURATION = 350;

interface LaunchIntroProps {
  onDone: () => void;
}

/**
 * The one-time animated intro shown the instant the native launch screen
 * hands off to JS: the "m" springs up from the baseline, then the roof
 * drops down and settles onto its shoulders — playing out the finished
 * mark the native splash already shows statically before fading to reveal
 * the real app underneath. See design ref 6n2, "Launch screen · final ·
 * the roof lands on the m".
 */
export function LaunchIntro({ onDone }: LaunchIntroProps) {
  const reduceMotion = useReducedMotion();
  const mProgress = useRef(new Animated.Value(0)).current;
  const roofProgress = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  // `onDone` is an inline closure at the call site (App.tsx), so a fresh
  // reference lands on every one of App's re-renders — depending on it
  // directly would re-run this effect mid-sequence, wiping the pending
  // timers and restarting the whole intro from scratch before it ever
  // reaches the fade. A ref lets the effect below run exactly once.
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
      mProgress.setValue(1);
      roofProgress.setValue(1);
      timers.push(setTimeout(finish, 500));
      return () => {
        cancelled = true;
        timers.forEach(clearTimeout);
      };
    }

    Animated.spring(mProgress, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 9 }).start();
    timers.push(
      setTimeout(() => {
        Animated.spring(roofProgress, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 9 }).start();
      }, 260),
    );
    timers.push(setTimeout(finish, RUN_DURATION));

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [reduceMotion, mProgress, roofProgress, overlayOpacity]);

  const mTranslateY = mProgress.interpolate({ inputRange: [0, 1], outputRange: [46, 0] });
  const mScale = mProgress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  const roofTranslateY = roofProgress.interpolate({ inputRange: [0, 1], outputRange: [-56, 0] });

  return (
    <Animated.View style={[styles.fill, { opacity: overlayOpacity }]} pointerEvents="none">
      <View style={styles.markWrap}>
        <Animated.View style={{ opacity: roofProgress, transform: [{ translateY: roofTranslateY }] }}>
          <Svg width={MARK_WIDTH} height={ROOF_HEIGHT} viewBox="0 0 100 46">
            <Path d={ROOF_PATH} fill="none" stroke={colors.ink} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
        <Animated.Text
          style={[styles.mLetter, { opacity: mProgress, transform: [{ translateY: mTranslateY }, { scale: mScale }] }]}
        >
          m
        </Animated.Text>
      </View>
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
  markWrap: {
    width: MARK_WIDTH,
    alignItems: 'center',
  },
  mLetter: {
    fontFamily: fontFamily.sans800,
    fontSize: 92,
    lineHeight: 92,
    color: colors.ink,
    marginTop: -8,
  },
});
