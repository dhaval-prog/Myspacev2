import React from 'react';
import Svg, { Circle } from 'react-native-svg';

interface OverflowIconProps {
  size?: number;
  color: string;
}

/** Three solid filled dots — the shared stroke-only Icon component can't render a fill. */
export function OverflowIcon({ size = 19, color }: OverflowIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={5.5} r={1.7} fill={color} />
      <Circle cx={12} cy={12} r={1.7} fill={color} />
      <Circle cx={12} cy={18.5} r={1.7} fill={color} />
    </Svg>
  );
}
