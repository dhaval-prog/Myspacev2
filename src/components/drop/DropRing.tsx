import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { dpColor } from '../../theme/dropTokens';

const DefsAny = Defs as unknown as React.ComponentType<{ children?: React.ReactNode }>;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface DropRingProps {
  pct: number;
  size?: number;
  animate?: boolean;
  children?: React.ReactNode;
}

/** Circular wavelength-score progress ring — p1-to-p2 gradient stroke, animates in over 1100ms. */
export function DropRing({ pct, size = 168, animate = true, children }: DropRingProps) {
  const strokeWidth = 14;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useRef(new Animated.Value(animate ? 0 : pct)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.timing(progress, { toValue: pct, duration: 1100, useNativeDriver: false }).start();
  }, [pct, animate, progress]);

  const dashOffset = progress.interpolate({ inputRange: [0, 100], outputRange: [circumference, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ transform: [{ rotate: '-90deg' }] }}>
      <Svg width={size} height={size}>
        <DefsAny>
          <SvgLinearGradient id="dropWaveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={dpColor.p1} />
            <Stop offset="100%" stopColor={dpColor.p2} />
          </SvgLinearGradient>
        </DefsAny>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={dpColor.sunken} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#dropWaveGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </Svg>
      </View>
      <View style={{ position: 'absolute', alignItems: 'center' }}>{children}</View>
    </View>
  );
}
