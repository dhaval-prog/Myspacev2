/**
 * Received Letters (Throw inbox) design tokens — ported verbatim from the design handoff's
 * `assets/tokens.json` ("Letters Arrival v2"). Deliberately its own token set, not merged into
 * `throwTokens.ts`: this screen's palette (paper `#FBF8F1`, ink-blue handwriting `#2346C8`,
 * accent blue `#2F6BFF`) is close to but distinct from the rest of Throw's own tokens (e.g.
 * `throwColor.paper` is `#FBF6EC`, `throwColor.activeBlue` is `#3D7BFF`) — the handoff is the
 * single source of truth for this screen's exact look, so its own hex values are kept exact
 * rather than reconciled with the neighboring palette.
 *
 * `layout` coordinates are all in the handoff's 390×844 reference frame — every consumer scales
 * them by the actual container size (see ThrowInboxScreen's own `SCALE`).
 */

export const inboxColor = {
  ink: '#111111',
  paper: '#FBF8F1',
  paperBack: '#F3EEE3',
  paperBack2: '#EFE9DC',
  flap: '#E7DFCF',
  mapBg: '#EDEDEA',
  accentBlue: '#2F6BFF',
  inkBlue: '#2346C8',
  ruleLine: 'rgba(47,107,255,0.10)',
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
