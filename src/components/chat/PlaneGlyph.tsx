import React from 'react';
import Svg, { Path } from 'react-native-svg';

const PLANE_BODY = 'M4 30 L60 8 L38 58 L30 36 Z';
const PLANE_WING = 'M30 36 L60 8 L22 40 Z';

/** The two-tone paper-plane glyph used for send buttons and status ticks throughout Chats — per
 * the MySpace Chats Throw handoff's own rule, status ticks are plane glyphs, never checkmarks. */
export function PlaneGlyph({ size, bodyFill, wingFill }: { size: number; bodyFill: string; wingFill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d={PLANE_BODY} fill={bodyFill} />
      {wingFill && <Path d={PLANE_WING} fill={wingFill} />}
    </Svg>
  );
}
