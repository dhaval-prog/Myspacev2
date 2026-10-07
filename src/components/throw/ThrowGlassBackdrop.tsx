import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { throwGlass } from '../../theme/throwTokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// react-native-svg's web typings omit `children` on Defs (a typing gap, not a runtime issue) — cast once.
const DefsAny = Defs as unknown as React.ComponentType<{ children?: React.ReactNode }>;

interface ThrowGlassBackdropProps {
  /** How tall a strip of the screen to cover, as a multiple of screen width — only needs to
   * reach as far down as the glass surfaces sitting on top of it. Ignored when `fill` is set. */
  heightMultiplier?: number;
  /** Day/night blob coloring — only meaningfully differs when `fill` is set, since the two small
   * chrome-strip call sites always sit over the warm-paper day background regardless of hour. */
  isDay?: boolean;
  /** Covers the full screen (a solid day/night base plus the blobs) instead of a top strip —
   * ThrowHomeScreen's "map background off" state, replacing the real map entirely. */
  fill?: boolean;
}

/**
 * Soft lime/pale blobs behind Throw's glass chrome (header, buttons, cards) — same technique as
 * the Games hub / NPAT glassmorphism backdrops, reusing Home's own lime identity instead of a
 * Throw-specific hue, per the "match Home's colour" redesign. In `fill` mode it instead stands in
 * for the whole map (day keeps this same lime/pale pair; night swaps to a dark base + blue/violet
 * blobs) per the "glassmorphism instead of the battery/data-hungry live map" setting.
 */
export function ThrowGlassBackdrop({ heightMultiplier = 1, isDay = true, fill = false }: ThrowGlassBackdropProps) {
  const height = fill ? SCREEN_HEIGHT : SCREEN_WIDTH * heightMultiplier;
  const blobA = fill && !isDay ? throwGlass.blobNightBlue : throwGlass.blobLime;
  const blobB = fill && !isDay ? throwGlass.blobNightViolet : throwGlass.blobPale;
  return (
    <View style={[styles.wrap, fill && { right: 0, bottom: 0, backgroundColor: isDay ? throwGlass.fillBaseDay : throwGlass.fillBaseNight }]} pointerEvents="none">
      <Svg width={SCREEN_WIDTH} height={height}>
        <DefsAny>
          <RadialGradient id="throwBlobA" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={blobA} stopOpacity={1} />
            <Stop offset="100%" stopColor={blobA} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="throwBlobB" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={blobB} stopOpacity={1} />
            <Stop offset="100%" stopColor={blobB} stopOpacity={0} />
          </RadialGradient>
        </DefsAny>
        <Circle cx={SCREEN_WIDTH * 0.85} cy={height * 0.12} r={SCREEN_WIDTH * 0.55} fill="url(#throwBlobA)" />
        <Circle cx={SCREEN_WIDTH * 0.1} cy={height * 0.45} r={SCREEN_WIDTH * 0.5} fill="url(#throwBlobB)" />
        {fill && <Circle cx={SCREEN_WIDTH * 0.7} cy={height * 0.8} r={SCREEN_WIDTH * 0.5} fill="url(#throwBlobB)" />}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0 },
});
