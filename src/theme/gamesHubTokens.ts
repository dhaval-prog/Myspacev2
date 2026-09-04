/**
 * Games hub design tokens — lifted verbatim from the "MySpace Games · 3A
 * Games hub · A · Tabletop" handoff. Self-contained (like spaceCardsTokens.ts
 * and npatTokens.ts): this hub uses Plus Jakarta Sans + DM Mono, the same
 * display faces as the two games it links to, kept out of the shared
 * fontFamily tokens in typography.ts so they can't leak into the rest of
 * the app.
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
  bgTop: '#D9EFBE',
  bgMid: '#EFF6E4',
  bgBottom: '#F7F6E2',

  ink: '#16210C',
  lime: '#C3EA4F',
  white: '#FFFFFF',

  ink52: 'rgba(22,33,12,.52)',
  ink50: 'rgba(22,33,12,.5)',
  ink45: 'rgba(22,33,12,.45)',
  ink42: 'rgba(22,33,12,.42)',
  ink40: 'rgba(22,33,12,.4)',
  ink28: 'rgba(22,33,12,.28)',
  ink16: 'rgba(22,33,12,.16)',
  ink14: 'rgba(22,33,12,.14)',
  ink12: 'rgba(22,33,12,.12)',
  ink09: 'rgba(22,33,12,.09)',
  ink07: 'rgba(22,33,12,.07)',
  ink06: 'rgba(22,33,12,.06)',
  ink05: 'rgba(22,33,12,.05)',

  up: '#5F8A22',
  upBg: 'rgba(95,138,34,.12)',
  gold: '#E9B02F',
  goldMuted: '#B08A18',
  danger: '#D33243',

  avatarMuted: '#5A6B4B',

  sheet: '#FBFCF7',
  scrim: 'rgba(22,33,12,.42)',
  rowMuted: 'rgba(22,33,12,.05)',
  rank1RowBg: 'rgba(233,176,47,.12)',

  npatCard: ['#1E3009', '#2C4118'] as const,
  cardsCard: ['#2A1148', '#3F1C63'] as const,

  npatTile: 'rgba(195,234,79,.2)',
  cardsTile: 'rgba(233,176,47,.18)',

  onDark50: 'rgba(255,255,255,.5)',
  onDark70: 'rgba(255,255,255,.7)',
  onDark14: 'rgba(255,255,255,.14)',
} as const;
