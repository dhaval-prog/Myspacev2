import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface LockIconProps {
  size?: number;
  color: string;
  strokeWidth?: number;
  /** Adds the filled keyhole dot — used only for the large 6p-8 lock badge. */
  withKeyhole?: boolean;
}

/** Rounded padlock body + shackle — the rounded-rect shape isn't expressible as a single stroke path. */
export function LockIcon({ size = 18, color, strokeWidth = 1.7, withKeyhole }: LockIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4.6} y={10.4} width={14.8} height={9.6} rx={3.4} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8.4 10.4V7.9a3.6 3.6 0 0 1 7.2 0v2.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {withKeyhole ? <Circle cx={12} cy={15.2} r={1.1} fill={color} stroke="none" /> : null}
    </Svg>
  );
}
