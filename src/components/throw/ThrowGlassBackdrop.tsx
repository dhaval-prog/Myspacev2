import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { throwGlass } from '../../theme/throwTokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// react-native-svg's web typings omit `children` on Defs (a typing gap, not a runtime issue) — cast once.
const DefsAny = Defs as unknown as React.ComponentType<{ children?: React.ReactNode }>;

interface ThrowGlassBackdropProps {
  /** How tall a strip of the screen to cover, as a multiple of screen width — only needs to
   * reach as far down as the glass surfaces sitting on top of it. */
  heightMultiplier?: number;
}

/**
 * Soft lime/pale blobs behind Throw's glass chrome (header, buttons, cards) — same technique as
 * the Games hub / NPAT glassmorphism backdrops, reusing Home's own lime identity instead of a
 * Throw-specific hue, per the "match Home's colour" redesign.
 */
export function ThrowGlassBackdrop({ heightMultiplier = 1 }: ThrowGlassBackdropProps) {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg width={SCREEN_WIDTH} height={SCREEN_WIDTH * heightMultiplier}>
        <DefsAny>
          <RadialGradient id="throwBlobLime" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={throwGlass.blobLime} stopOpacity={1} />
            <Stop offset="100%" stopColor={throwGlass.blobLime} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="throwBlobPale" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={throwGlass.blobPale} stopOpacity={1} />
            <Stop offset="100%" stopColor={throwGlass.blobPale} stopOpacity={0} />
          </RadialGradient>
        </DefsAny>
        <Circle cx={SCREEN_WIDTH * 0.85} cy={SCREEN_WIDTH * 0.12} r={SCREEN_WIDTH * 0.55} fill="url(#throwBlobLime)" />
        <Circle cx={SCREEN_WIDTH * 0.1} cy={SCREEN_WIDTH * 0.45} r={SCREEN_WIDTH * 0.5} fill="url(#throwBlobPale)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0 },
});
