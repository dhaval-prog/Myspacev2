/**
 * NPAT (Name, Place, Animal, Thing) design tokens — lifted verbatim from the
 * "MySpace Games · 1A · 1B" design handoff. Kept self-contained (like
 * spaceCardsTokens.ts) rather than folded into the shared theme: this
 * feature uses Plus Jakarta Sans as its display face — every other screen
 * uses Figtree — even though it otherwise shares the app's ink/lime palette.
 */

export const npFont = {
  sans400: 'PlusJakartaSans_400Regular',
  sans500: 'PlusJakartaSans_500Medium',
  sans600: 'PlusJakartaSans_600SemiBold',
  sans700: 'PlusJakartaSans_700Bold',
  sans800: 'PlusJakartaSans_800ExtraBold',
  mono500: 'DMMono_500Medium',
} as const;

export const npColor = {
  lime: '#C3EA4F',
  ink: '#16210C',

  headerTop: '#16210C',
  headerMid: '#2C4118',
  headerBottom: '#42601F',

  sheet: '#FBFCF7',
  fieldBg: 'rgba(22,33,12,.05)',
  fieldLabel: '#7E8D72',
  pillInactiveText: '#4E6238',
  tabInactiveText: '#5A6B4B',

  ready: '#4FA83A',
  notReady: '#E0A32A',
  neutralDot: 'rgba(22,33,12,.2)',

  tileN: '#C3EA4F',
  tileP: '#EDFDFF',
  tileA: '#FFE3B0',
  tileT: '#FFFFFF',

  onDark60: 'rgba(255,255,255,.6)',
  onDark52: 'rgba(255,255,255,.52)',
  onDark50: 'rgba(255,255,255,.5)',
  onDark42: 'rgba(255,255,255,.4)',

  glowShadow: '#C3EA4F',
} as const;

export const ROUND_OPTIONS = [3, 5, 10] as const;
export const TIMER_OPTIONS = [15, 20, 30, 45] as const;

export const LETTER_TILES = [
  { letter: 'N', bg: npColor.tileN, rotateDeg: -5, translateY: 0 },
  { letter: 'P', bg: npColor.tileP, rotateDeg: 3, translateY: -5 },
  { letter: 'A', bg: npColor.tileA, rotateDeg: -3, translateY: 2 },
  { letter: 'T', bg: npColor.tileT, rotateDeg: 6, translateY: -3 },
] as const;
