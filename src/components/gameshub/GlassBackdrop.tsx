import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { ghColor } from '../../theme/gamesHubTokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// react-native-svg's web typings omit `children` on Defs (a typing gap, not a runtime issue) — cast once.
const DefsAny = Defs as unknown as React.ComponentType<{ children?: React.ReactNode }>;

/**
 * Soft color blobs behind the hub's content — the thing a glassmorphism surface
 * actually blurs. Without something colorful under it, a frosted panel over this
 * hub's pale, nearly-flat background gradient would just read as plain translucent
 * white, with nothing to tell it apart from a plain card at a lower opacity.
 * Radial gradients (not plain circles) so the edges dissolve rather than reading as
 * flat colored discs floating on the page outside the glass panels covering them.
 */
export function GlassBackdrop() {
  return (
    <View style={styles.svgWrap} pointerEvents="none">
      <Svg width={SCREEN_WIDTH} height={SCREEN_WIDTH * 1.4}>
        <DefsAny>
          <RadialGradient id="blobLime" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={ghColor.blobLime} stopOpacity={1} />
            <Stop offset="100%" stopColor={ghColor.blobLime} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="blobGold" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={ghColor.blobGold} stopOpacity={1} />
            <Stop offset="100%" stopColor={ghColor.blobGold} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="blobPurple" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={ghColor.blobPurple} stopOpacity={1} />
            <Stop offset="100%" stopColor={ghColor.blobPurple} stopOpacity={0} />
          </RadialGradient>
        </DefsAny>
        <Circle cx={SCREEN_WIDTH * 0.82} cy={SCREEN_WIDTH * 0.18} r={SCREEN_WIDTH * 0.55} fill="url(#blobLime)" />
        <Circle cx={SCREEN_WIDTH * 0.1} cy={SCREEN_WIDTH * 0.62} r={SCREEN_WIDTH * 0.5} fill="url(#blobGold)" />
        <Circle cx={SCREEN_WIDTH * 0.7} cy={SCREEN_WIDTH * 1.05} r={SCREEN_WIDTH * 0.6} fill="url(#blobPurple)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  svgWrap: { position: 'absolute', top: 0, left: 0 },
});
