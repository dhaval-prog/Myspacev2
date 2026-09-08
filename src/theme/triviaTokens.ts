/**
 * Trivia Night design tokens — self-contained like npatTokens.ts and
 * spaceCardsTokens.ts. Same shared brand accent (lime/ink) and Plus Jakarta
 * Sans/DM Mono type as the other two games; a deep indigo/blue gradient is
 * Trivia's own hue, the way NPAT reads green and Space Cards reads violet.
 */

export const trFont = {
  sans400: 'PlusJakartaSans_400Regular',
  sans500: 'PlusJakartaSans_500Medium',
  sans600: 'PlusJakartaSans_600SemiBold',
  sans700: 'PlusJakartaSans_700Bold',
  sans800: 'PlusJakartaSans_800ExtraBold',
  mono500: 'DMMono_500Medium',
} as const;

export const trColor = {
  lime: '#C3EA4F',
  ink: '#16210C',

  headerTop: '#0B1440',
  headerMid: '#182B6B',
  headerBottom: '#2E4590',

  sheet: '#FBFCF7',
  fieldLabel: '#7E8D72',
  pillInactiveText: '#4E6238',
  tabInactiveText: '#5A6B4B',

  ready: '#4FA83A',
  notReady: '#E0A32A',
  neutralDot: 'rgba(22,33,12,.2)',

  correct: '#4FA83A',
  incorrect: '#E0523C',

  onDark60: 'rgba(255,255,255,.6)',
  onDark52: 'rgba(255,255,255,.52)',
  onDark50: 'rgba(255,255,255,.5)',
  onDark42: 'rgba(255,255,255,.4)',

  glowShadow: '#2E4590',

  sheetGlassFill: 'rgba(251,252,247,.7)',
  glassBorder: 'rgba(255,255,255,.5)',
  rowGlassFill: 'rgba(255,255,255,.4)',
  rowGlassFillDark: 'rgba(255,255,255,.08)',
  rowGlassBorder: 'rgba(255,255,255,.6)',
  rowGlassBorderDark: 'rgba(255,255,255,.16)',

  blobIndigoDark: 'rgba(46,69,144,.4)',
  blobLimeDark: 'rgba(195,234,79,.22)',
} as const;

export const CATEGORY_OPTIONS = [
  'Random',
  'General Knowledge',
  'Books',
  'Film',
  'Music',
  'Television',
  'Video Games',
  'Sports',
  'Science',
  'History',
  'Geography',
  'Technology',
  'Food',
  'Nature',
  'Animals',
  'Art',
  'Computers',
  'Mathematics',
] as const;

export const DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard', 'mixed'] as const;
export const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20] as const;
export const TIME_PER_QUESTION_OPTIONS = [10, 20, 30, 60] as const;

export const TRIVIA_MAX_PLAYERS = 20;
