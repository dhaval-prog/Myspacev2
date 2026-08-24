import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  path: string;
  size?: number;
  color: string;
  strokeWidth?: number;
}

/** Thin geometric line icon — every icon in the app is one SVG path. */
export function Icon({ path, size = 18, color, strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={path}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
