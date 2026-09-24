import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { dpColor } from '../../theme/dropTokens';

const DefsAny = Defs as unknown as React.ComponentType<{ children?: React.ReactNode }>;

/** Two soft blurred color blobs behind the screen content — Parallax's "DawnBlobs". */
export function DropBackdrop() {
  const { width } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <DefsAny>
          <RadialGradient id="dawnCoral" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={dpColor.p1} stopOpacity={0.34} />
            <Stop offset="70%" stopColor={dpColor.p1} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="dawnPeri" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={dpColor.p2} stopOpacity={0.3} />
            <Stop offset="70%" stopColor={dpColor.p2} stopOpacity={0} />
          </RadialGradient>
        </DefsAny>
        <Circle cx={60} cy={40} r={150} fill="url(#dawnCoral)" />
        <Circle cx={width - 40} cy={230} r={160} fill="url(#dawnPeri)" />
      </Svg>
    </View>
  );
}
