import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface CopyIconProps {
  size?: number;
  color: string;
  strokeWidth?: number;
}

/** Two overlapping rounded squares — deliberately no strokeLinecap (spec wants square line caps here). */
export function CopyIcon({ size = 18, color, strokeWidth = 1.7 }: CopyIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={9} y={9} width={11} height={11} rx={2.6} stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </Svg>
  );
}
