import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { throwColor } from '../../theme/throwTokens';

interface LandingPulseProps {
  size?: number;
}

/**
 * A single expand-and-fade ring, played once right as the paper plane reaches the recipient's
 * pin — the "it has actually arrived" beat that closes out the launch → fly → land arc. Pure
 * Animated (no native map API), so it drops into a native `<Marker anchor={{x:0.5,y:0.5}}>`
 * unchanged (a plain sized box centers itself there automatically) and a web DOM overlay (the
 * caller offsets its wrapper by half this size, same as the plane), same pattern as
 * PaperPlane/LocationPinGlyph. Unlike PulseRing (a looping "live sharing" indicator), this one
 * plays exactly once and is meant to be unmounted once it's done.
 */
export function LandingPulse({ size = 70 }: LandingPulseProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [anim]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 0.3, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: throwColor.clay,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}
