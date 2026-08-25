/** Parses a formatted amount string like "₹ 2,834" or "-₹150" into a number. */
export function parseAmount(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  return Number(String(value ?? '').replace(/[^0-9.]/g, '')) || 0;
}

export function formatMoney(value: number): string {
  return `₹ ${Math.max(0, Math.round(value)).toLocaleString('en-IN')}`;
}

/** "Today" / "Yesterday" / "12 Mar" for a date relative to now. */
export function relativeDateLabel(date: Date, now: Date = new Date()): string {
  const yesterday = new Date(now.getTime() - 86400000);
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "12 March 2026" — the long form used on transaction rows. */
export function longDateLabel(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('en-GB', { month: 'long' });
  return `${day} ${month} ${date.getFullYear()}`;
}

const DAY_SUFFIX = (n: number) => {
  if (n % 10 === 1 && n !== 11) return 'st';
  if (n % 10 === 2 && n !== 12) return 'nd';
  if (n % 10 === 3 && n !== 13) return 'rd';
  return 'th';
};

export function ordinalDay(n: number): string {
  return `${n}${DAY_SUFFIX(n)}`;
}

export function daysInCurrentMonth(now: Date = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

/** "DD / MM" of the next occurrence of a reset day (1st/15th/Last day/custom ordinal). */
export function nextResetLabel(day: string, now: Date = new Date()): string {
  const eom = daysInCurrentMonth(now);
  const dd = day === 'Last day' ? eom : Math.min(eom, parseInt(day, 10) || 1);
  const month = dd >= now.getDate() ? now.getMonth() : now.getMonth() + 1;
  const when = new Date(now.getFullYear(), month, 1);
  return `${String(dd).padStart(2, '0')} / ${String(when.getMonth() + 1).padStart(2, '0')}`;
}

export function randomRid(): string {
  return Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join('');
}

export function formatJoinId(rid: string): string {
  return `${rid.slice(0, 3)} ${rid.slice(3, 7)} ${rid.slice(7)}`;
}

/** Masked card number for display, e.g. "*** **** 0334". */
export function maskRid(rid: string): string {
  return `*** **** ${rid.slice(7)}`;
}

/** Parses a Postgres `date` string ("YYYY-MM-DD") as a local calendar date, avoiding UTC-midnight timezone shift. */
export function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Formats a Date as the "YYYY-MM-DD" string a Postgres `date` column expects. */
export function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
