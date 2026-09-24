/**
 * Drop feature design tokens — a faithful port of Parallax's own design
 * system (colors, gradients, shadows, radii, typography conventions).
 * Self-contained (like gamesHubTokens.ts) and scoped to just the Drop
 * feature's own screens/sheets/cards.
 */

export const dpFont = {
  disp: 'InstrumentSerif_400Regular',
  dispItalic: 'InstrumentSerif_400Regular_Italic',
  ui400: 'HankenGrotesk_400Regular',
  ui500: 'HankenGrotesk_500Medium',
  ui600: 'HankenGrotesk_600SemiBold',
  ui700: 'HankenGrotesk_700Bold',
  ui800: 'HankenGrotesk_800ExtraBold',
  mono: 'SpaceMono_400Regular',
  monoBold: 'SpaceMono_700Bold',
} as const;

export const dpColor = {
  bg0: '#FBF1F2',
  bg1: '#F1ECFB',
  paper: '#FBF7F3',
  surface: '#FFFDFD',
  surfaceSoft: 'rgba(255,255,255,0.62)',
  sunken: '#F4ECF4',
  line: 'rgba(58,51,64,0.09)',
  ink: '#3A3340',
  inkSoft: '#8B8398',
  inkMute: '#B7B0C2',
  p1: '#FF8E7A',
  p1Deep: '#EF6A53',
  p2: '#9D95F5',
  p2Deep: '#7064E6',
  match: '#54C2A0',
  matchDeep: '#2E9C7C',
  usSoft: 'rgba(218,202,245,0.6)',
  danger: '#D33243',
} as const;

export const dpGradient = {
  us: { colors: ['#FF8E7A', '#C387C9', '#9D95F5'], locations: [0, 0.48, 1] },
  usSoft: { colors: ['rgba(255,142,122,0.16)', 'rgba(157,149,245,0.16)'], locations: [0, 1] },
  dawn: { colors: ['#FCEFF0', '#F6EDF6', '#EEEDFB'], locations: [0, 0.42, 1] },
} as const;

export const dpShadow = {
  shadow: { shadowColor: 'rgba(112,100,230,0.13)', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 1, shadowRadius: 22, elevation: 16 },
  shadowSoft: { shadowColor: 'rgba(112,100,230,0.10)', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 1, shadowRadius: 15, elevation: 10 },
  shadowPop: { shadowColor: 'rgba(58,40,70,0.18)', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 1, shadowRadius: 22, elevation: 16 },
} as const;

export const dpRadius = {
  pill: 999,
  card: 26,
  cardLg: 30,
  tile: 14,
  cardMd: 22,
  cardSm: 20,
  cardXs: 18,
  input: 16,
  sm: 12,
} as const;

export const dpSpace = {
  gutter: 20,
  cardPad: 16,
  gap: 12,
} as const;

/** The small uppercase monospace "eyebrow" label used above every Serif heading. */
export const dpKickStyle = {
  fontFamily: dpFont.mono,
  fontSize: 10,
  lineHeight: 12,
  includeFontPadding: false,
  letterSpacing: 1.8,
  textTransform: 'uppercase' as const,
  color: dpColor.inkMute,
};
