import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { scColor, scGeometry } from '../../theme/spaceCardsTokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface TimerRingProps {
  secondsLeft: number;
  limit: number;
  urgent: boolean;
  reduceMotion?: boolean;
  children?: React.ReactNode;
  /** Overrides the default Space Cards geometry — e.g. NPAT's smaller round-timer ring. */
  size?: number;
  thickness?: number;
  /** Overrides the lime/urgent auto pick — e.g. NPAT's amber mid-tier before the red danger tier. */
  color?: string;
}

/** The conic countdown ring around the discard pile — react-native-svg stands in for CSS conic-gradient, which RN has no equivalent for. */
export function TimerRing({ secondsLeft, limit, urgent, reduceMotion, children, size: sizeOverride, thickness: thicknessOverride, color }: TimerRingProps) {
  const size = sizeOverride ?? scGeometry.timerRing.size;
  const thickness = thicknessOverride ?? scGeometry.timerRing.thickness;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useRef(new Animated.Value(limit > 0 ? secondsLeft / limit : 1)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (limit <= 0) return;
    Animated.timing(progress, {
      toValue: secondsLeft / limit,
      duration: reduceMotion ? 0 : 1000,
      useNativeDriver: false,
    }).start();
  }, [secondsLeft, limit, reduceMotion, progress]);

  useEffect(() => {
    if (!urgent || reduceMotion) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [urgent, reduceMotion, pulse]);

  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size, transform: [{ scale }] }]}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,.08)" strokeWidth={thickness} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color ?? (urgent ? scColor.urgent : scColor.lime)}
          strokeWidth={thickness}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="butt"
          rotation="-90"
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <Animated.View style={styles.center}>{children}</Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
  },
});
