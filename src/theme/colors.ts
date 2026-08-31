/**
 * MySpace V2 color tokens.
 * Source of truth: MySpace 6a/6b reference — lime, deep olive ink, pale ice.
 * Do not introduce hues outside this system.
 */
export const colors = {
  // Primary tokens
  lime: '#C3EA4F',
  ink: '#16210C',
  pale: '#EDFDFF',
  white: '#FFFFFF',

  // Ink at reduced opacity — dividers, borders, secondary/muted text
  divider: 'rgba(22,33,12,0.08)',
  border: 'rgba(22,33,12,0.12)',
  textPrimary: '#16210C',
  textSecondary: 'rgba(22,33,12,0.72)',
  textMuted: 'rgba(22,33,12,0.60)',
  textFaint: 'rgba(22,33,12,0.45)',
  textDisabled: 'rgba(22,33,12,0.40)',
  textLocked: 'rgba(22,33,12,0.28)',
  placeholder: 'rgba(22,33,12,0.42)',

  // Inactive circular badge (category count)
  badgeInactiveBg: 'rgba(22,33,12,0.12)',
  badgeInactiveFg: 'rgba(22,33,12,0.50)',

  // Locked circular badge (gated until data exists)
  badgeLockedBg: 'rgba(22,33,12,0.06)',
  badgeLockedFg: 'rgba(22,33,12,0.30)',

  // Subtle press feedback wash
  pressWash: 'rgba(22,33,12,0.04)',

  // Destructive / alert accent (forgot-password link)
  danger: '#D33243',

  // --- Auth screens (Sign Up / Log In) ---
  // Soft welcoming gradient, distinct from the flat lime of the main app
  authGradient: ['#C6E9A8', '#DDEDDF', '#EDF2EA', '#F6F5DF'] as string[],
  authGradientStops: [0, 0.26, 0.58, 1] as number[],
  authFieldBg: 'rgba(255,255,255,0.86)',
  authCtaShadowColor: '#7AA82C',
  authCtaShadowOpacity: 0.32,

  // --- Expenses / wallet screens ---
  // Deliberately dark, distinct from the rest of the app — a real wallet, not a lime panel
  walletBg: '#060606',
  walletSurface: '#161616',
  walletBorder: 'rgba(255,255,255,0.1)',
  walletTextPrimary: '#FFFFFF',
  walletTextSecondary: 'rgba(255,255,255,0.45)',
  walletSheetBg: '#FFFFFF',
  walletSheetMuted: '#F3F3F0',
  walletSheetFaint: '#F7F7F5',
  walletSheetBorder: 'rgba(0,0,0,0.1)',
  walletSheetTextPrimary: '#111111',
  walletSheetTextSecondary: 'rgba(0,0,0,0.5)',
  walletSheetTextFaint: 'rgba(0,0,0,0.42)',
  walletAccentBlue: '#1668E8',
  walletAccentBlueSoftBg: 'rgba(22,104,232,0.12)',
  walletAccentRed: '#E8352A',

  // --- Split screens ---
  // Warm coral-to-magenta gradient over a soft lavender-white surface,
  // distinct from both the lime home and the dark wallet.
  splitBg: '#F7F7FB',
  splitSurface: '#FFFFFF',
  splitInk: '#1B2A63',
  splitInkFaint30: 'rgba(27,42,99,0.3)',
  splitInkFaint42: 'rgba(27,42,99,0.42)',
  splitInkFaint45: 'rgba(27,42,99,0.45)',
  splitInkFaint5: 'rgba(27,42,99,0.5)',
  splitInkFaint55: 'rgba(27,42,99,0.55)',
  splitInkFaint6: 'rgba(27,42,99,0.6)',
  splitInkFaint07: 'rgba(27,42,99,0.07)',
  splitInkFaint08: 'rgba(27,42,99,0.08)',
  splitInkFaint09: 'rgba(27,42,99,0.09)',
  splitGradient: ['#FF6A5A', '#FA2E6E', '#F0186B'] as string[],
  splitAccent: '#FA2E6E',
  splitAccentSoftBg: '#FDE8EE',
  splitPositiveBg: '#E6F6EC',
  splitPositiveFg: '#1F9254',
  splitDangerBg: 'rgba(211,50,67,0.12)',
  splitDangerFg: '#D33243',

  // --- Friends / chat screens ---
  // Warm amber-to-coral, sociable and distinct from Split's magenta and
  // the dark wallet — over the same soft off-white surface as Split.
  friendsBg: '#FFF9F2',
  friendsSurface: '#FFFFFF',
  friendsInk: '#3A2413',
  friendsInkFaint30: 'rgba(58,36,19,0.3)',
  friendsInkFaint45: 'rgba(58,36,19,0.45)',
  friendsInkFaint55: 'rgba(58,36,19,0.55)',
  friendsInkFaint08: 'rgba(58,36,19,0.08)',
  friendsGradient: ['#FFB86B', '#FF7A59', '#E8456B'] as string[],
  friendsAccent: '#FF7A45',
  friendsAccentSoftBg: '#FFE9DA',
  friendsLockedBg: 'rgba(58,36,19,0.06)',
  friendsLockedFg: 'rgba(58,36,19,0.32)',
} as const;

export type ColorToken = keyof typeof colors;
