import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { ghColor } from '../../theme/gamesHubTokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// react-native-svg's web typings omit `children` on Defs (a typing gap, not a runtime issue) — cast once.
const DefsAny = Defs as unknown as React.ComponentType<{ children?: React.ReactNode }>;

/**
 * Soft color blobs behind the hub's content — the thing a glassmorphism surface
 * actually blurs. Without something colorful under it, a frosted panel over this
 * hub's soft off-white background would just read as plain translucent white,
 * with nothing to tell it apart from a plain card at a lower opacity.
 * Radial gradients (not plain circles) so the edges dissolve rather than reading as
 * flat colored discs floating on the page outside the glass panels covering them.
 * Spans the full screen height (not just the area behind the fold) so the ambient
 * glow carries all the way down — otherwise the screen reads as this ambient
 * treatment up top over a flat, solid-color base for the rest of the scroll.
 */
export function GlassBackdrop() {
  return (
    <View style={styles.svgWrap} pointerEvents="none">
      <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT}>
        <DefsAny>
          <RadialGradient id="blobGreen" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={ghColor.blobGreen} stopOpacity={1} />
            <Stop offset="100%" stopColor={ghColor.blobGreen} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="blobSecondary" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={ghColor.blobSecondary} stopOpacity={1} />
            <Stop offset="100%" stopColor={ghColor.blobSecondary} stopOpacity={0} />
          </RadialGradient>
        </DefsAny>
        <Circle cx={SCREEN_WIDTH * 0.82} cy={SCREEN_HEIGHT * 0.1} r={SCREEN_WIDTH * 0.55} fill="url(#blobSecondary)" />
        <Circle cx={SCREEN_WIDTH * 0.08} cy={SCREEN_HEIGHT * 0.38} r={SCREEN_WIDTH * 0.55} fill="url(#blobGreen)" />
        <Circle cx={SCREEN_WIDTH * 0.75} cy={SCREEN_HEIGHT * 0.66} r={SCREEN_WIDTH * 0.6} fill="url(#blobSecondary)" />
        <Circle cx={SCREEN_WIDTH * 0.15} cy={SCREEN_HEIGHT * 0.92} r={SCREEN_WIDTH * 0.55} fill="url(#blobGreen)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  svgWrap: { position: 'absolute', top: 0, left: 0 },
});
