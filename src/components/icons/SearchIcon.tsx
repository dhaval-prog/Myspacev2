import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface SearchIconProps {
  size?: number;
  color: string;
}

/**
 * Circle + diagonal line — the one icon in the app that isn't expressible
 * as a single stroke path (the shared Icon component only renders one
 * Path), so it gets its own tiny component instead.
 */
export function SearchIcon({ size = 18, color }: SearchIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={6.4} stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M16 16l4 4" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}
