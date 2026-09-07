import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { colors } from '../../theme';

// react-native-svg's web typings omit `children` on Defs (a typing gap, not a runtime issue) — cast once.
const DefsAny = Defs as unknown as React.ComponentType<{ children?: React.ReactNode }>;

/**
 * Soft lime/gold blobs behind the Friends screens — the thing the glass
 * surfaces actually blur. `friendsCanvas` already varies in hue top to
 * bottom, but these give the frosted cards something with more contrast
 * to diffuse than a slow-moving background gradient alone.
 */
export function FriendsGlow() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 200 400" preserveAspectRatio="none">
        <DefsAny>
          <RadialGradient id="fgLime" cx="18%" cy="8%" r="60%">
            <Stop offset="0%" stopColor={colors.lime} stopOpacity={0.4} />
            <Stop offset="100%" stopColor={colors.lime} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="fgGold" cx="88%" cy="58%" r="55%">
            <Stop offset="0%" stopColor="#FFD873" stopOpacity={0.3} />
            <Stop offset="100%" stopColor="#FFD873" stopOpacity={0} />
          </RadialGradient>
        </DefsAny>
        <Rect x={0} y={0} width={200} height={400} fill="url(#fgLime)" />
        <Rect x={0} y={0} width={200} height={400} fill="url(#fgGold)" />
      </Svg>
    </View>
  );
}
