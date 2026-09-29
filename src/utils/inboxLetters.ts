import type { ThrowLetter } from '../types/throw';

const WEEKDAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "TODAY · 9:12 AM" / "YESTERDAY · 8:20 PM" / "SUN · 7:40 PM" / "SEP 18 · 6:30 AM" — and the
 * matching short chip label ("TODAY"/"YDAY"/"SUN"/"SEP 18"), per the design handoff's own date
 * treatment. Shared between ThrowInboxScreen (the standalone Received Letters screen) and the
 * in-place arrival panel on ThrowHomeScreen — both show the same letters the same way. */
export function formatLetterDate(iso: string): { date: string; short: string } {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (sameDay(d, now)) return { date: `TODAY · ${time}`, short: 'TODAY' };
  if (sameDay(d, yesterday)) return { date: `YESTERDAY · ${time}`, short: 'YDAY' };
  if (daysAgo < 7 && daysAgo >= 0) return { date: `${WEEKDAY[d.getDay()]} · ${time}`, short: WEEKDAY[d.getDay()] };
  const short = `${MONTH[d.getMonth()]} ${d.getDate()}`;
  return { date: `${short} · ${time}`, short };
}

export function bodyForLetter(letter: ThrowLetter): string {
  if (letter.messageText) return letter.messageText;
  if (letter.photoUrls.length > 0) return 'Sent a photo.';
  return 'A handwritten letter.';
}
