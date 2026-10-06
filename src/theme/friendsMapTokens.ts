/**
 * Friends Map (Chats "Map" tab) design tokens — ported from the design handoff's own
 * `CLAUDE_CODE_PROMPT.md` token table and `source/MySpace Friends Map.dc.html`'s inline styles.
 *
 * Deliberately its own token set rather than reusing `colors.ts`/`throwLettersV3Tokens.ts`
 * directly: a couple of values genuinely overlap (ink/lime/coral already exist on the shared
 * `colors` token), but most of this screen's palette (sheet cream, map tint, me-blue, live-green)
 * is specific to this one handoff and not meant to leak into the rest of the app's shared tokens.
 *
 * `layout` coordinates are all in the handoff's 390×844 reference frame — every consumer scales
 * them by `scale = containerWidth / layout.phone.width`, same convention as `v3Layout`.
 */

export const fmColor = {
  ink: '#16210C',
  lime: '#C3EA4F',
  limeDark: '#8FB52E',
  readGreen: '#4E6B1C',
  sheetCream: '#F6F5DF',
  mapBase: '#E4EBDD',
  mapTileTint: '#B9D99A',
  mapFadeTop: 'rgba(221,237,223,0.95)',
  meBlue: '#2F6BFF',
  coral: '#FF8A6B',
  white: '#FFFFFF',
} as const;

export const fmFont = {
  ui400: 'Figtree_400Regular',
  ui500: 'Figtree_500Medium',
  ui600: 'Figtree_600SemiBold',
  ui700: 'Figtree_700Bold',
  ui800: 'Figtree_800ExtraBold',
  mono400: 'DMMono_400Regular',
  mono500: 'DMMono_500Medium',
} as const;

export const fmRadius = {
  pill: 999,
  card: 22,
  sheetTop: 30,
  phone: 46,
} as const;

export const fmShadow = {
  // "0 8px 20px rgba(22,33,12,.12)" from the handoff's own token table.
  soft: { shadowColor: fmColor.ink, shadowOpacity: 0.12, shadowOffset: { width: 0, height: 8 }, shadowRadius: 20, elevation: 3 },
} as const;

export const fmLayout = {
  phone: { width: 390, height: 844 },
  searchRowY: 54,
  searchPillH: 50,
  addBtnSize: 50,
  chipH: 34,
  mapControlSize: 48,
  // Vertical anchor for the camera's own center point — intentionally above true geometric
  // center (844/2 = 422) so the bottom sheet + nav bar never sit over whatever's centered,
  // matching the handoff's own fixed `OY = 290` tile-origin offset.
  cameraAnchorY: 290,
  sheetBottom: 84,
  sheetHandleW: 40,
  sheetHandleH: 5,
  listCardW: 132,
  listAvatarSize: 40,
  detailAvatarSize: 58,
  pinDefaultSize: 42,
  pinSelectedSize: 54,
  pinLiveDotSize: 14,
} as const;
