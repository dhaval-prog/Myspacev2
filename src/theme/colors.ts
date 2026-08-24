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
  placeholder: 'rgba(22,33,12,0.42)',

  // Inactive circular badge (category count)
  badgeInactiveBg: 'rgba(22,33,12,0.12)',
  badgeInactiveFg: 'rgba(22,33,12,0.50)',

  // Subtle press feedback wash
  pressWash: 'rgba(22,33,12,0.04)',
} as const;

export type ColorToken = keyof typeof colors;
