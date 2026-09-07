/**
 * Games hub design tokens — "LiquidGlass": a futuristic glassmorphism reskin
 * built around a deep-space dark background and a single brand gradient
 * (#ff76e9 → #007bff) used sparingly at hero moments — CTAs, the points
 * ring, active states — while everything else stays neutral frosted glass.
 * Self-contained (like spaceCardsTokens.ts and npatTokens.ts) and scoped to
 * just the Games hub screen and its own sheets/rows.
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
  // Deep-space background the glass floats over.
  bgTop: '#0A0518',
  bgMid: '#140B2E',
  bgBottom: '#1B0A35',

  // The one brand gradient — pink to blue — reserved for hero surfaces.
  gradientPink: '#ff76e9',
  gradientBlue: '#007bff',
  // A lighter blue for small text/icons on the dark background, where the
  // saturated brand blue reads a little too dark to stay legible at small sizes.
  accentBlueLight: '#5FB8FF',

  ink: '#150A2A',
  white: '#FFFFFF',

  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,.64)',
  textTertiary: 'rgba(255,255,255,.48)',
  textFaint: 'rgba(255,255,255,.34)',
  textOnGradient: '#FFFFFF',

  hairline: 'rgba(255,255,255,.16)',
  hairlineStrong: 'rgba(255,255,255,.28)',
  surface: 'rgba(255,255,255,.07)',
  surfaceStrong: 'rgba(255,255,255,.12)',

  up: '#5FB8FF',
  upBg: 'rgba(0,123,255,.18)',
  danger: '#FF5C7A',

  avatarMuted: '#4A3A66',

  scrim: 'rgba(5,3,15,.62)',
  rank1RowBg: 'rgba(255,118,233,.14)',

  npatTile: 'rgba(255,118,233,.16)',
  cardsTile: 'rgba(0,123,255,.16)',

  // Frosted-glass surfaces: a dark BlurView backdrop plus a translucent tint on
  // top (the tint carries most of the "glass" color since blur intensity is
  // kept low enough that content underneath stays legible through it), a
  // hairline near-white border to catch the light along the edge, and a
  // softer shadow than a flat opaque card would use — glass reads as
  // floating, not sitting flush on the page.
  glassFill: 'rgba(255,255,255,.08)',
  glassBorder: 'rgba(255,255,255,.2)',
  npatGlassFill: 'rgba(255,118,233,.09)',
  npatGlassBorder: 'rgba(255,118,233,.4)',
  cardsGlassFill: 'rgba(0,123,255,.1)',
  cardsGlassBorder: 'rgba(0,123,255,.42)',
  sheetGlassFill: 'rgba(16,9,32,.74)',
  rowGlassFill: 'rgba(255,255,255,.06)',
  rowGlassBorder: 'rgba(255,255,255,.14)',
  rowGlassSelfFill: 'rgba(255,118,233,.14)',

  // Soft color blobs floating behind the glass — the thing a glassmorphism
  // surface actually blurs. Without something colorful under it, a frosted
  // panel over a flat dark background would just read as plain translucent
  // grey, with nothing to tell it apart from an opaque card at low opacity.
  // Radial gradients (not plain circles) so the edges dissolve rather than
  // reading as flat colored discs floating on the page outside the glass
  // panels covering them.
  blobPink: 'rgba(255,118,233,.55)',
  blobBlue: 'rgba(0,123,255,.55)',
  blobViolet: 'rgba(151,84,255,.32)',
} as const;
