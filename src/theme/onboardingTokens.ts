/**
 * Onboarding design tokens — "Sticker Pop": cream dot-grid paper, thick ink outlines, hard
 * offset shadows (no blur), tilted sticker elements, physical stamp/pop animations. Deliberately
 * its own visual system, far from the rest of the app's day/night brand palettes — self-
 * contained, same convention as throwTokens.ts/gamesHubTokens.ts, never merged into the shared
 * colors/fontFamily tokens so it can't leak into the rest of the app.
 */

export const obFont = {
  display500: 'BricolageGrotesque_500Medium',
  display700: 'BricolageGrotesque_700Bold',
  display800: 'BricolageGrotesque_800ExtraBold',
  mono400: 'SpaceMono_400Regular',
  mono700: 'SpaceMono_700Bold',
  dm400: 'DMMono_400Regular',
  dm500: 'DMMono_500Medium',
  hand600: 'Caveat_600SemiBold',
  hand700: 'Caveat_700Bold',
  ui500: 'Figtree_500Medium',
  ui600: 'Figtree_600SemiBold',
  ui700: 'Figtree_700Bold',
  ui800: 'Figtree_800ExtraBold',
} as const;

export const obColor = {
  paper: '#F4EFE3',
  ink: '#111111',
  inkSoft: 'rgba(17,17,17,.68)',
  inkMute: 'rgba(17,17,17,.55)',
  inkFaint: 'rgba(17,17,17,.35)',
  deepInk: '#16210C',

  cobalt: '#2B4BFF',
  tomato: '#FF4F2E',
  sunflower: '#FFD23F',
  lime: '#C3EA4F',
  white: '#FFFFFF',

  cardBg: '#FFFDF7',
} as const;

/** Hard offset shadows, no blur — small/medium/lifted per the handoff spec. */
export const obShadow = {
  sm: { shadowColor: '#111', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 2 },
  md: { shadowColor: '#111', shadowOffset: { width: 3, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  lifted: { shadowColor: '#111', shadowOffset: { width: 5, height: 5 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6 },
  /** Shadow in a non-ink accent color (e.g. a tomato-shadowed black button). */
  color: (color: string, size: 'sm' | 'md' | 'lifted' = 'md') => ({
    ...(size === 'sm' ? obShadow.sm : size === 'lifted' ? obShadow.lifted : obShadow.md),
    shadowColor: color,
  }),
} as const;

export const obRadius = {
  chip: 8,
  input: 16,
  card: 22,
  sheet: 30,
  pill: 999,
} as const;

export const obSpace = {
  gutter: 20,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
} as const;

/** The dot-grid paper background every onboarding screen sits on. */
export const dotGridBg = {
  backgroundColor: obColor.paper,
} as const;
