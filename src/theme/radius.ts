/**
 * Corner radius tokens. `organic` is the asymmetric, single-corner radius
 * used on the hero content surface — the defining MySpace shape. Never
 * substitute it with a uniform rounded rectangle.
 */
export const radius = {
  sm: 14,
  md: 22,
  lg: 28,
  organic: 34,
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;
