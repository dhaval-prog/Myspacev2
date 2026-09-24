import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { throwColor } from '../../theme/throwTokens';

interface PaperPlaneProps {
  size?: number;
  color?: string;
}

/** A simple origami paper-plane silhouette, pointing along +x (east) at rotation 0. */
export function PaperPlane({ size = 28, color = throwColor.paper }: PaperPlaneProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 12 L22 3 L13 12 L22 21 Z" fill={color} />
      <Path d="M2 12 L13 12 L9 17 Z" fill={color} opacity={0.7} />
      <Path d="M13 12 L22 3 L13 12 L22 21 Z" stroke="rgba(0,0,0,0.12)" strokeWidth={0.5} fill="none" />
    </Svg>
  );
}
