/**
 * Consistent spacing scale — mirrors the rhythm used across the reference
 * (14 / 16 / 20 / 22 / 24 / 34). Nothing outside this scale should be
 * hand-typed as a raw pixel value in component styles.
 */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 10,
  ms: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 22,
  huge: 24,
  organic: 34,
} as const;

export type SpacingToken = keyof typeof spacing;
