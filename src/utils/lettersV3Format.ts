import { computeNextTrigger } from './throwAlerts';
import type { AlertSchedule } from '../types/throw';

const WEEKDAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "SAT OCT 4 · 6:00 AM" — the Received Letters v3 alert pill's own mono-caps date format,
 * computed from the sender's recurring `AlertSchedule` (which itself carries no absolute date)
 * via its next real occurrence, same source `confirmThrowAlert` itself fires against. Distinct
 * from `formatAlertSchedule` (a conversational "Once at 6:00 AM", used for the accessibility
 * label) since the handoff's own pill text is this terser mono-caps form instead. */
export function formatAlertPillLabel(schedule: AlertSchedule): string {
  const d = computeNextTrigger(schedule);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${WEEKDAY[d.getDay()]} ${MONTH[d.getMonth()]} ${d.getDate()} · ${time}`;
}

/** "1,180 KM" — the handoff's own distance unit for the postmark/chip labels, converted from the
 * app's own mile-based `distanceMiles` (every other Throw surface shows miles) rather than adding
 * a second, diverging unit to the data layer itself. */
export function compactKm(miles: number): string {
  return `${Math.round(miles * 1.60934).toLocaleString('en-US')} KM`;
}
