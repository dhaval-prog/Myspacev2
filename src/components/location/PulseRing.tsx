import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { colors } from '../../theme';

interface PulseRingProps {
  /** Diameter of the pin this ring sits behind, so it can center itself. */
  avatarSize: number;
  /** Diameter the ring expands to before fading out. Defaults to ~1.9x the avatar. */
  maxSize?: number;
  color?: string;
}

/**
 * A looping "radar sweep" ring behind a live/sharing pin — expands from the
 * avatar's own size out to `maxSize` while fading, then repeats. Pure
 * Animated (no native map API involved), so the same component drops into
 * both MapCanvas.web.tsx and MapCanvas.native.tsx unchanged.
 */
export function PulseRing({ avatarSize, maxSize, color = colors.coral }: PulseRingProps) {
  const size = maxSize ?? avatarSize * 1.9;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [avatarSize / size, 1] });
  const opacity = anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.45, 0.16, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: avatarSize / 2 - size / 2,
        top: avatarSize / 2 - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}
