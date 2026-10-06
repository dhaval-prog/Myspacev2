import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

// The handoff's own msIn bubble-entrance curve — a deliberate overshoot, distinct from the app's
// global "quiet, never bouncy" EASE (same convention LetterCardV3's EASE_RISE already uses).
export const EASE_BUBBLE_IN = Easing.bezier(0.3, 1.3, 0.5, 1);

/** Wraps one message bubble with the handoff's msIn entrance (opacity + translateY + scale,
 * overshoot ease). Keyed by message id in the parent `.map()`, so React only mounts (and
 * therefore only animates) genuinely new messages — existing ones never replay it on re-render. */
export function AnimatedMessageWrap({ children, style, reduceMotion }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; reduceMotion: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: reduceMotion ? 0 : 350, easing: EASE_BUBBLE_IN, useNativeDriver: true }).start();
  }, []);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}
