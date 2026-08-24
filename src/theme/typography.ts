import { TextStyle } from 'react-native';
import { colors } from './colors';

/**
 * Font family tokens. Calibre (the reference's true display face) is a
 * licensed font with no web-safe distribution, so Figtree — its closest
 * openly-licensed match in weight and warmth — stands in for it. RN can't
 * cascade between custom fonts within a single Text the way CSS font
 * stacks do, so the app gates its first paint until Figtree/DM Mono finish
 * loading (see App.tsx) rather than flashing a mismatched system font.
 * DM Mono carries every uppercase label and numeric/count indicator,
 * exactly as in the reference.
 */
export const fontFamily = {
  sans400: 'Figtree_400Regular',
  sans500: 'Figtree_500Medium',
  sans600: 'Figtree_600SemiBold',
  sans700: 'Figtree_700Bold',
  sans800: 'Figtree_800ExtraBold',
  mono400: 'DMMono_400Regular',
  mono500: 'DMMono_500Medium',
  fallback: 'System',
} as const;

const em = (size: number, tracking: number) => Math.round(size * tracking * 1000) / 1000;

/**
 * Semantic type scale. Each entry is a ready-to-spread TextStyle so
 * components never hand-pick font sizes or tracking values.
 */
export const typography = {
  // Wordmark
  logo: {
    fontFamily: fontFamily.sans600,
    fontSize: 17,
    letterSpacing: em(17, -0.01),
    color: colors.textPrimary,
  } satisfies TextStyle,

  // Hero editorial headline
  display: {
    fontFamily: fontFamily.sans600,
    fontSize: 40,
    lineHeight: 40,
    letterSpacing: em(40, -0.028),
    color: colors.textPrimary,
  } satisfies TextStyle,

  // Hero supporting line
  body: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 19.6,
    color: colors.textSecondary,
  } satisfies TextStyle,

  // Category row label — active/selected
  categoryLabelActive: {
    fontFamily: fontFamily.sans600,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: em(30, -0.022),
    color: colors.textPrimary,
  } satisfies TextStyle,

  // Category row label — inactive
  categoryLabelInactive: {
    fontFamily: fontFamily.sans500,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: em(30, -0.022),
    color: colors.textDisabled,
  } satisfies TextStyle,

  // Context card title
  heading: {
    fontFamily: fontFamily.sans600,
    fontSize: 19,
    lineHeight: 22.8,
    letterSpacing: em(19, -0.015),
    color: colors.textPrimary,
  } satisfies TextStyle,

  // Context card supporting line
  caption: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    lineHeight: 17.4,
    color: colors.textSecondary,
  } satisfies TextStyle,

  // Uppercase mono micro-label (context card kicker)
  monoLabel: {
    fontFamily: fontFamily.mono500,
    fontSize: 9.5,
    letterSpacing: em(9.5, 0.16),
    textTransform: 'uppercase',
    color: colors.textMuted,
  } satisfies TextStyle,

  // Circular count badge
  monoBadge: {
    fontFamily: fontFamily.mono500,
    fontSize: 13,
  } satisfies TextStyle,

  // Search field
  searchInput: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.textPrimary,
  } satisfies TextStyle,

  searchPlaceholder: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.placeholder,
  } satisfies TextStyle,

  // Bottom navigation label
  navLabel: {
    fontFamily: fontFamily.sans800,
    fontSize: 10.5,
    color: colors.textPrimary,
  } satisfies TextStyle,
} as const;

