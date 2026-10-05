/**
 * Received Letters (Throw inbox) "v3" design tokens — ported verbatim from the design handoff's
 * `assets/tokens.json` and `source/Letters Arrival v3.dc.html`'s own inline styles/`renderVals()`.
 *
 * Deliberately its own token set, not merged into `throwInboxTokens.ts` (the "v2" tokens the
 * in-place received-letters panel on ThrowHomeScreen still uses): the two screens' exact pixel
 * values differ (v2's letter card is 354×330 with 3 equal fold panels; v3's is 354×300 with 2
 * halves plus a literal envelope/flap/pocket arrival) and the in-place panel is being kept exactly
 * as it already is, per explicit request — this file lets the new standalone screen match its own
 * handoff exactly without touching v2's numbers at all.
 *
 * `layout` coordinates are all in the handoff's 390×844 reference frame — every consumer scales
 * them by the actual container size.
 */

export const v3Color = {
  ink: '#111111',
  paper: '#FBF8F1',
  paperBack: '#F3EEE3',
  envelopeInside: '#DDD3BF',
  envelopePocket: '#F6F1E6',
  envelopeFlap: '#EEE6D5',
  mapBg: '#EDEDEA',
  accentBlue: '#2F6BFF',
  accentBlueTint: 'rgba(47,107,255,0.10)',
  inkBlue: '#2346C8',
  planeTint: '#CFDDFF',
  ruleLine: 'rgba(47,107,255,0.10)',
  deleteRed: '#FF3B30',
  muted: '#8A8A8A',
  mutedDark: '#6F6F6B',
  binDark: 'rgba(17,17,17,0.78)',
  mediaViewerBg: '#0E0E10',
  mediaStageBg: '#1C1C1F',
  chipRead: 'rgba(251,248,241,0.55)',
  chipUnread: '#FFFFFF',
} as const;

export const v3Font = {
  ui: 'Figtree',
  ui800: 'Figtree_800ExtraBold',
  ui700: 'Figtree_700Bold',
  ui600: 'Figtree_600SemiBold',
  ui400: 'Figtree_400Regular',
  mono: 'DMMono_500Medium',
  hand: 'Caveat_500Medium',
  hand600: 'Caveat_600SemiBold',
} as const;

export const v3Radius = {
  phone: 52,
  letter: 22,
  envelope: 10,
  chip: 16,
  button: 24,
  mediaStage: 22,
  thumb: 14,
  pill: 999,
} as const;

export const v3Layout = {
  phone: { width: 390, height: 844 },
  contactsY: 56,
  toastY: 208,
  letter: { x: 18, y: 262, w: 354, h: 300, halfH: 150, rulesTop: 100, rulesBottom: 54 },
  // Envelope width matches the letter's own exactly (x flush with the letter's own left edge) so
  // the letter is always fully hidden behind it while closed — a narrower envelope let the
  // letter's side edges peek out past the envelope's own during the opening animation.
  envelope: { x: 18, y: 352, w: 354, h: 190, flapH: 112, stripeInset: 6, seal: 38 },
  landingPoint: { x: 195, y: 447 },
  actionRow: { x: 18, y: 576, h: 48, gap: 10, mediaBtn: 48 },
  chipRow: { bottom: 12 },
  bin: { y: 584, size: 54, deleteThresholdPx: 80 },
  mediaViewer: { header: 56, stageX: 16, stageY: 116, stageH: 480, captionY: 612, thumbsY: 700, thumb: 56 },
} as const;
