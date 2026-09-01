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
    fontSize: 19,
    lineHeight: 22,
    letterSpacing: em(19, -0.02),
    color: colors.textPrimary,
  } satisfies TextStyle,

  // Category row label — inactive
  categoryLabelInactive: {
    fontFamily: fontFamily.sans500,
    fontSize: 19,
    lineHeight: 22,
    letterSpacing: em(19, -0.02),
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

  // --- Detail screen (rooms / items flows) ---

  // Back button
  backLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: colors.textPrimary,
  } satisfies TextStyle,

  // Rail tile caption
  railLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 10,
    lineHeight: 11,
    letterSpacing: em(10, -0.005),
    textAlign: 'center',
  } satisfies TextStyle,

  // Detail column title ("Which room are you adding?")
  detailTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 22,
    lineHeight: 23.1,
    letterSpacing: em(22, -0.03),
    color: colors.textPrimary,
  } satisfies TextStyle,

  // Detail column supporting line
  detailSubline: {
    fontFamily: fontFamily.sans400,
    fontSize: 11.5,
    lineHeight: 16.7,
    color: colors.textSecondary,
  } satisfies TextStyle,

  // Uppercase mono form-section label ("Category (optional)")
  formLabel: {
    fontFamily: fontFamily.mono500,
    fontSize: 9,
    letterSpacing: em(9, 0.16),
    textTransform: 'uppercase',
    color: colors.textMuted,
  } satisfies TextStyle,

  // Item card title
  itemTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 14,
    letterSpacing: em(14, -0.015),
    color: colors.textPrimary,
  } satisfies TextStyle,

  // Item card subtitle (category · room)
  itemSub: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.textSecondary,
  } satisfies TextStyle,

  // Item card expiry micro-line
  itemExpiry: {
    fontFamily: fontFamily.sans400,
    fontSize: 8,
    color: colors.textSecondary,
  } satisfies TextStyle,

  // Dropdown / chip row label (category picker, form room chips)
  chipLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.textPrimary,
  } satisfies TextStyle,

  // Primary action button label (Save / Add item)
  buttonLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    letterSpacing: em(14.5, -0.01),
  } satisfies TextStyle,

  // Bottom-sheet field input
  sheetInput: {
    fontFamily: fontFamily.sans600,
    fontSize: 17,
    color: colors.textPrimary,
  } satisfies TextStyle,

  // Calendar month title
  calendarTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.textPrimary,
  } satisfies TextStyle,

  // Calendar day-of-week initials
  calendarDow: {
    fontFamily: fontFamily.mono500,
    fontSize: 8,
    letterSpacing: em(8, 0.06),
    color: colors.textFaint,
  } satisfies TextStyle,

  // Calendar day number
  calendarDay: {
    fontFamily: fontFamily.sans400,
    fontSize: 10.5,
  } satisfies TextStyle,

  // --- Auth screens (Sign Up / Log In) ---

  authTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 33,
    lineHeight: 36.3,
    letterSpacing: em(33, -0.025),
    color: colors.textPrimary,
    textAlign: 'center',
  } satisfies TextStyle,

  authSubline: {
    fontFamily: fontFamily.sans400,
    fontSize: 14,
    lineHeight: 20.3,
    color: colors.textSecondary,
    textAlign: 'center',
  } satisfies TextStyle,

  // Field placeholder / entered value
  authFieldText: {
    fontFamily: fontFamily.sans400,
    fontSize: 15.5,
    color: colors.placeholder,
  } satisfies TextStyle,

  // Masked password dots
  authFieldMono: {
    fontFamily: fontFamily.mono500,
    fontSize: 15,
    letterSpacing: em(15, 0.22),
    color: colors.textSecondary,
  } satisfies TextStyle,

  authButtonLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 16.5,
    color: colors.textPrimary,
  } satisfies TextStyle,

  // Inline bold link ("Log In", "Sign Up", "Terms of Service")
  authLink: {
    fontFamily: fontFamily.sans700,
    fontSize: 14,
    color: colors.textPrimary,
  } satisfies TextStyle,

  authForgot: {
    fontFamily: fontFamily.sans600,
    fontSize: 14,
    color: colors.danger,
  } satisfies TextStyle,

  authFooter: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    lineHeight: 20.8,
    color: colors.textSecondary,
    textAlign: 'center',
  } satisfies TextStyle,

  authDivider: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.textSecondary,
  } satisfies TextStyle,
} as const;

