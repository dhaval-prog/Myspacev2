export type Period = 'AM' | 'PM';

/** "HH:MM" (24h) -> "8:00 AM" for display. */
export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period: Period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

/** hour12 (1-12) + minute + AM/PM -> "HH:MM" (24h), for storage. */
export function toTime24(hour12: number, minute: number, period: Period): string {
  const h = (hour12 % 12) + (period === 'PM' ? 12 : 0);
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** "HH:MM" (24h) -> the picker's own hour12/minute/period fields. */
export function parseTime24(hhmm: string): { hour12: number; minute: number; period: Period } {
  const [h, m] = hhmm.split(':').map(Number);
  const period: Period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { hour12, minute: m, period };
}
