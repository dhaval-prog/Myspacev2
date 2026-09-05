import { Easing } from 'react-native';

/**
 * Space Cards' own, self-contained design tokens — colour, type, geometry
 * and motion — lifted verbatim from the design handoff's tokens.json. Kept
 * out of the shared theme (colors.ts / typography.ts) deliberately: this
 * feature uses a different display face (Plus Jakarta Sans, not Figtree)
 * and a colour system that shares nothing with the rest of the app.
 */

export const scFont = {
  sans400: 'PlusJakartaSans_400Regular',
  sans500: 'PlusJakartaSans_500Medium',
  sans600: 'PlusJakartaSans_600SemiBold',
  sans700: 'PlusJakartaSans_700Bold',
  sans800: 'PlusJakartaSans_800ExtraBold',
  mono400: 'DMMono_400Regular',
  mono500: 'DMMono_500Medium',
} as const;

export const scColor = {
  lime: '#C3EA4F',
  ink: '#16210C',

  tableDeep: '#170A2C',
  tableMid: '#241041',
  tableLift: '#3A1B5C',
  ringHole: '#28123F',
  cardBack: '#2E1550',
  stackFace: '#3B1F63',

  sheet1: '#1E0B2B',
  sheet2: '#3A1B4E',
  sheet3: '#5B3477',
  glass: 'rgba(255,255,255,.10)',
  glassBorder: 'rgba(255,255,255,.20)',

  ember: '#E8533B',
  tide: '#2F93D8',
  moss: '#2F9E4F',
  solar: '#E9B02F',

  urgent: '#F0603C',
  ok: '#C3EA4F',

  onDark: '#FFFFFF',
  onDark70: 'rgba(255,255,255,.72)',
  onDark48: 'rgba(255,255,255,.48)',
  onDark42: 'rgba(255,255,255,.42)',
  onLime: '#16210C',

  fillWeak: 'rgba(255,255,255,.07)',
  fillMid: 'rgba(255,255,255,.10)',
  fillStrong: 'rgba(255,255,255,.14)',
  navInk: 'rgba(17,17,17,.94)',
} as const;

/** The four playable colours, in wheel order (top-left, top-right, bottom-left, bottom-right). */
export const SC_COLOURS = ['ember', 'tide', 'moss', 'solar'] as const;
export type ScColourName = (typeof SC_COLOURS)[number];

export const SC_COLOUR_HEX: Record<ScColourName, string> = {
  ember: scColor.ember,
  tide: scColor.tide,
  moss: scColor.moss,
  solar: scColor.solar,
};

export const SC_COLOUR_LABEL: Record<ScColourName, string> = {
  ember: 'Ember',
  tide: 'Tide',
  moss: 'Moss',
  solar: 'Solar',
};

export const scGeometry = {
  // Bumped ~14% from the original handoff size (58x84) — at the original size, once
  // dimmed cards were fanned and overlapping, players couldn't reliably read which
  // card was which to make a pick.
  handCard: { w: 66, h: 96, radius: 13, ovalW: 48, ovalH: 71 },
  // Enlarged ~15% (80x112 -> 92x129) — the discard pile at the center of the board.
  pileCard: { w: 92, h: 129, radius: 15, ovalW: 67, ovalH: 94 },
  deckBack: { w: 56, h: 78, radius: 11 },
  timerRing: { size: 232, thickness: 9, hole: 214 },
  wheelTile: 106,
  handRowWidth: 305,
  maxHandPitch: 68,
} as const;

/** `min(68, (305 - 66) / (n - 1))` — cards overlap as the hand grows; flights land on this pitch. */
export function handPitch(n: number): number {
  if (n <= 1) return scGeometry.maxHandPitch;
  return Math.min(scGeometry.maxHandPitch, (scGeometry.handRowWidth - scGeometry.handCard.w) / (n - 1));
}

/** `rotate((i - (n-1)/2) * 7.5deg)`, `translateY(|i - centre| * 3.4px)` — the resting fan pose for card i of n. */
export function fanPose(i: number, n: number): { rotateDeg: number; translateY: number; x: number } {
  const centre = (n - 1) / 2;
  const d = i - centre;
  return {
    rotateDeg: d * 7.5,
    translateY: Math.abs(d) * 3.4,
    x: d * handPitch(n),
  };
}

export const scMotion = {
  easeEntrance: Easing.bezier(0.2, 0.85, 0.25, 1),
  easeFlight: Easing.bezier(0.2, 0.8, 0.25, 1),
  dealMs: 500,
  dealStaggerMs: 55,
  floatMs: 6400,
  floatPx: 5,
  playFlightMs: 440,
  drawFlightMs: 460,
  wheelSpreadMs: 440,
  wheelStaggerMs: 65,
  wheelHubDelayMs: 240,
  turnHandoffMs: 1250,
  ctaGlowMs: 3400,
} as const;
