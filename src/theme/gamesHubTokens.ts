/**
 * Games hub design tokens — a light glassmorphism reskin: a soft off-white
 * background with green/olive glows the frosted glass panels diffuse, and
 * one accent green reserved for hero moments (CTAs, the points ring, active
 * states) — while everything else stays neutral frosted-white glass. No
 * dark/deep-space surface anywhere on this screen. Self-contained (like
 * spaceCardsTokens.ts and npatTokens.ts) and scoped to just the Games hub
 * screen and its own sheets/rows.
 */

export const ghFont = {
  sans400: 'PlusJakartaSans_400Regular',
  sans500: 'PlusJakartaSans_500Medium',
  sans600: 'PlusJakartaSans_600SemiBold',
  sans700: 'PlusJakartaSans_700Bold',
  sans800: 'PlusJakartaSans_800ExtraBold',
  mono500: 'DMMono_500Medium',
} as const;

export const ghColor = {
  // Soft off-white background the glass floats over — flat, not a gradient,
  // since the ambient variation now comes from the glow blobs behind it.
  bgTop: '#F5F6F1',
  bgMid: '#F5F6F1',
  bgBottom: '#F5F6F1',

  // The two glow hues behind the glass panels.
  glowGreen: '#DCEBAA',
  glowSecondary: '#E8EBD9',

  // The one brand gradient — pale to accent — reserved for hero surfaces.
  gradientA: '#E8EBD9',
  gradientB: '#B8E83E',

  ink: '#20231F',
  white: '#FFFFFF',

  textPrimary: '#20231F',
  textSecondary: 'rgba(32,35,31,.64)',
  textTertiary: 'rgba(32,35,31,.48)',
  textFaint: 'rgba(32,35,31,.34)',
  // The gradient's accent stop is light, so label text on a gradient fill
  // still needs to be dark ink rather than white.
  textOnGradient: '#20231F',

  hairline: 'rgba(32,35,31,.1)',
  hairlineStrong: 'rgba(32,35,31,.18)',
  surface: 'rgba(32,35,31,.05)',
  surfaceStrong: 'rgba(32,35,31,.09)',

  // A darker, text-safe green — the raw accent reads fine as a fill (badges,
  // rings, tinted pill backgrounds) but too light for small text on a white
  // card, so legible foreground text (links, rank deltas) uses this instead.
  up: '#7AA82C',
  upBg: 'rgba(184,232,62,.22)',
  danger: '#D33243',

  avatarMuted: 'rgba(32,35,31,.55)',
  avatarFallbackBg: '#E8EBD9',

  scrim: 'rgba(32,35,31,.45)',
  rank1RowBg: 'rgba(220,235,170,.4)',

  npatTile: '#E8EBD9',
  cardsTile: '#DCEBAA',

  // Frosted-glass surfaces: a light BlurView backdrop plus a translucent
  // white tint on top (the tint carries most of the "glass" color since blur
  // intensity is kept low enough that the glow blobs underneath stay visible
  // through it), a soft dark hairline border to define the edge, and a
  // gentle shadow — glass reads as a floating card, not flush with the page.
  glassFill: 'rgba(255,255,255,.72)',
  glassBorder: 'rgba(32,35,31,.08)',
  npatGlassFill: 'rgba(232,235,217,.6)',
  npatGlassBorder: 'rgba(32,35,31,.08)',
  cardsGlassFill: 'rgba(220,235,170,.55)',
  cardsGlassBorder: 'rgba(32,35,31,.08)',
  rowGlassFill: 'rgba(255,255,255,.55)',
  rowGlassBorder: 'rgba(32,35,31,.08)',
  rowGlassSelfFill: 'rgba(184,232,62,.22)',

  // Soft color blobs floating behind the glass — the thing a glassmorphism
  // surface actually blurs. Without something colorful under it, a frosted
  // panel over a flat off-white background would just read as plain
  // translucent white, with nothing to tell it apart from an opaque card.
  // Radial gradients (not plain circles) so the edges dissolve rather than
  // reading as flat colored discs floating on the page outside the glass
  // panels covering them.
  blobGreen: 'rgba(220,235,170,.65)',
  blobSecondary: 'rgba(232,235,217,.6)',

  // --- Sheet (Leaderboard / Points) — same light palette, aligned exactly ---
  sheetBg: 'rgba(255,255,255,.9)',
  sheetBorder: 'rgba(32,35,31,.1)',
  sheetHandle: 'rgba(32,35,31,.2)',
  sheetTextPrimary: '#20231F',
  sheetTextSecondary: 'rgba(32,35,31,.64)',
  sheetTextTertiary: 'rgba(32,35,31,.48)',
  sheetTextFaint: 'rgba(32,35,31,.34)',
  sheetSurface: 'rgba(32,35,31,.05)',
  sheetRowFill: 'rgba(32,35,31,.04)',
  sheetRowBorder: 'rgba(32,35,31,.08)',
  sheetLeaderBg: '#E8EBD9',
  sheetSelfFill: 'rgba(184,232,62,.18)',
  sheetSelfBorder: 'rgba(184,232,62,.55)',
  sheetAccentOnLight: '#7AA82C',
  sheetDanger: '#D33243',
} as const;
