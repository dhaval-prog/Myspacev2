import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// react-native-svg's web typings omit `children` on Defs (a typing gap, not a runtime issue) — cast once.
const DefsAny = Defs as unknown as React.ComponentType<{ children?: React.ReactNode }>;

interface NpatGlassBackdropProps {
  /** Two colours for the soft radial blobs floating behind the screen's glass surfaces — the thing the blur actually blurs. */
  colors: readonly [string, string];
  /** How tall a strip of the screen to cover — round/lobby screens scroll well past one viewport, so this only needs to reach as far down as any glass surface does. */
  heightMultiplier?: number;
}

/**
 * Soft color blobs behind an NPAT screen's frosted-glass surfaces — same idea as
 * the Games hub's GlassBackdrop. Radial gradients (not plain circles) so the
 * edges dissolve rather than reading as flat colored discs outside the glass
 * panels covering them.
 */
export function NpatGlassBackdrop({ colors, heightMultiplier = 1.3 }: NpatGlassBackdropProps) {
  const [a, b] = colors;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg width={SCREEN_WIDTH} height={SCREEN_WIDTH * heightMultiplier}>
        <DefsAny>
          <RadialGradient id="npatBlobA" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={a} stopOpacity={1} />
            <Stop offset="100%" stopColor={a} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="npatBlobB" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={b} stopOpacity={1} />
            <Stop offset="100%" stopColor={b} stopOpacity={0} />
          </RadialGradient>
        </DefsAny>
        <Circle cx={SCREEN_WIDTH * 0.85} cy={SCREEN_WIDTH * 0.15} r={SCREEN_WIDTH * 0.5} fill="url(#npatBlobA)" />
        <Circle cx={SCREEN_WIDTH * 0.05} cy={SCREEN_WIDTH * 0.7} r={SCREEN_WIDTH * 0.55} fill="url(#npatBlobB)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0 },
});
