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

  // Raw ink-opacity steps named to match design-token handoffs directly
  // (6p-series mockups) — used where no existing semantic token lines up.
  ink75: 'rgba(22,33,12,0.75)',
  ink70: 'rgba(22,33,12,0.7)',
  ink65: 'rgba(22,33,12,0.65)',
  ink55: 'rgba(22,33,12,0.55)',
  ink50: 'rgba(22,33,12,0.5)',
  ink38: 'rgba(22,33,12,0.38)',
  ink30: 'rgba(22,33,12,0.3)',
  ink10: 'rgba(22,33,12,0.1)',
  ink07: 'rgba(22,33,12,0.07)',
  ink06: 'rgba(22,33,12,0.06)',

  // White-on-ink opacity steps — text and buttons on the dark chat header
  onInk60: 'rgba(255,255,255,0.6)',
  onInk55: 'rgba(255,255,255,0.55)',
  onInk50: 'rgba(255,255,255,0.5)',
  onInkChip: 'rgba(255,255,255,0.16)',
  onInkBtn: 'rgba(255,255,255,0.13)',
  onInkBtnSoft: 'rgba(255,255,255,0.12)',

  // Translucent white card surfaces over a gradient (never opaque #FFF)
  surface90: 'rgba(255,255,255,0.9)',
  surface70: 'rgba(255,255,255,0.7)',
  surface60: 'rgba(255,255,255,0.6)',
  surface55: 'rgba(255,255,255,0.55)',

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
  // Reuses the core lime/ink/pale identity (not a separate feature color,
  // unlike Split/Expenses) — Friends & chat is a continuation of Home.
  nearBlack: '#111111',
  coral: '#FF8A6B',
  onlineDot: '#3FBF6A',
  onlineDotOnInk: '#8BE07E',
  onlineDotRing: '#E4EFE2',
  friendsCanvas: ['#C6E9A8', '#DDEDDF', '#EDF2EA', '#F6F5DF'] as string[],
  friendsCanvasStops: [0, 0.26, 0.58, 1] as number[],
  friendsChatCanvas: ['#DDEDDF', '#EDF2EA', '#F6F5DF'] as string[],
  friendsChatCanvasStops: [0, 0.4, 1] as number[],
  friendsScannerCanvas: ['#2C3A1C', '#151E0C', '#0B1006'] as string[],
} as const;

export type ColorToken = keyof typeof colors;
