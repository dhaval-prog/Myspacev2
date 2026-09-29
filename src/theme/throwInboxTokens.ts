/**
 * Received Letters (Throw inbox) design tokens — ported from the design handoff's
 * `assets/tokens.json` ("Letters Arrival v2"), with `paper` and `inkBlue` overridden to match
 * the Throw compose letter's own colors exactly (`throwColor.paper` #FBF6EC and LetterCanvas's
 * `INK_BLUE` #4A55B0) per explicit request that the received letter read as the same paper/ink
 * as the one you write on. The rest of the handoff's own palette (accent blue, delete red, etc.)
 * is kept as-is.
 *
 * `layout` coordinates are all in the handoff's 390×844 reference frame — every consumer scales
 * them by the actual container size (see ThrowInboxScreen's own `SCALE`).
 */

export const inboxColor = {
  ink: '#111111',
  paper: '#FBF6EC',
  paperBack: '#F3EEE3',
  paperBack2: '#EFE9DC',
  flap: '#E7DFCF',
  mapBg: '#EDEDEA',
  accentBlue: '#2F6BFF',
  inkBlue: '#4A55B0',
  ruleLine: 'rgba(17,17,17,0.07)',
  deleteRed: '#FF3B30',
  muted: '#8A8A8A',
  binDark: 'rgba(17,17,17,0.78)',
} as const;

export const inboxFont = {
  ui: 'Figtree',
  mono: 'DMMono_500Medium',
  hand: 'Caveat_500Medium',
  hand600: 'Caveat_600SemiBold',
} as const;

export const inboxRadius = {
  letter: 24,
  chip: 16,
  pill: 999,
} as const;

export const inboxLayout = {
  phone: { width: 390, height: 844 },
  letter: { x: 18, y: 262, w: 354, h: 330, panels: 3, panelH: 110 },
  landingPoint: { x: 195, y: 427 },
  mapAnchor: { x: 195, y: 228 },
  chipRowY: 620,
  chip: { w: 52, h: 52 },
  binY: 726,
} as const;
