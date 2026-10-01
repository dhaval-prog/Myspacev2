import { Platform, Vibration } from 'react-native';

/** `navigator.vibrate` on web, RN's own `Vibration` module on native — no new dependency. iOS
 * ignores the custom durations/patterns RN's Vibration API takes (a single default "tick"
 * regardless of what's passed, a known platform limitation), so this is a best-effort match to a
 * design handoff's own `navigator.vibrate(...)` calls, not exact everywhere. */
export function vibrate(pattern: number | number[]) {
  if (Platform.OS === 'web') {
    (navigator as { vibrate?: (p: number | number[]) => void }).vibrate?.(pattern);
    return;
  }
  Vibration.vibrate(pattern);
}
