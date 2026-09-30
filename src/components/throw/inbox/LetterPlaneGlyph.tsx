import React from 'react';
import Svg, { Path } from 'react-native-svg';

export type LetterPlaneVariant = 'default' | 'active' | 'delete' | 'unread' | 'read';

interface LetterPlaneGlyphProps {
  size?: number;
  variant?: LetterPlaneVariant;
  strokeWidth?: number;
  /** The chip row draws its plane glyphs tilted -14° (see the handoff's own chip markup) — the
   * big flying plane and delete ghost don't, since they're rotated wholesale by their own
   * flight/drag transform instead. */
  tiltDeg?: number;
}

const FILL: Record<LetterPlaneVariant, { body: string; wing: string; stroke: string }> = {
  default: { body: '#FBF8F1', wing: '#E6E0D3', stroke: '#9A958C' },
  active: { body: '#FFFFFF', wing: '#CFDDFF', stroke: '#FFFFFF' },
  delete: { body: '#FFFFFF', wing: '#FFD2CE', stroke: '#FFFFFF' },
  // Per explicit request: the chip row's own plane reads unread/read status directly, independent
  // of which chip is currently selected — a solid accent-blue plane (white stroke keeps it legible
  // even on the selected chip's own blue box) for anything not yet opened, a plain white plane
  // (matching the read state everywhere else in Throw) once it's been read.
  unread: { body: '#2F6BFF', wing: '#5C8CFF', stroke: '#FFFFFF' },
  read: { body: '#FFFFFF', wing: '#E8EEFF', stroke: '#B9C6E6' },
};

/**
 * The letter-arrival screen's own paper-plane glyph — exact path data from the design handoff's
 * `assets/icons/paper-plane*.svg` (a 64×64 viewBox, distinct from the rest of Throw's own
 * `PaperPlane.tsx` silhouette), reused for the big flying plane, the slider's chips, and the
 * delete-drag ghost by swapping `variant`/`strokeWidth`/`tiltDeg` rather than duplicating markup
 * three times.
 */
export function LetterPlaneGlyph({ size = 64, variant = 'default', strokeWidth, tiltDeg = 0 }: LetterPlaneGlyphProps) {
  const c = FILL[variant];
  const sw = strokeWidth ?? (variant === 'default' ? 1.5 : 3);
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" style={tiltDeg ? [{ transform: [{ rotate: `${tiltDeg}deg` }] }] : undefined}>
      <Path d="M4 30 L60 8 L38 58 L30 36 Z" fill={c.body} stroke={c.stroke} strokeWidth={sw} strokeLinejoin="round" />
      <Path d="M30 36 L60 8 L22 40 Z" fill={c.wing} stroke={c.stroke} strokeWidth={sw} strokeLinejoin="round" />
    </Svg>
  );
}
