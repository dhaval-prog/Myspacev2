import { Easing } from 'react-native';

/**
 * Shared animation constants. Quiet and premium, never bouncy — a single
 * consistent ease across every interaction in the app.
 */
export const EASE = Easing.bezier(0.22, 1, 0.36, 1);

export const duration = {
  micro: 180,
  state: 250,
  screen: 400,
} as const;
