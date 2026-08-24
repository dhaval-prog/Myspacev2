import type { Item } from '../types/space';

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS_LONG[month]} ${year}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysUntil(iso: string, today: Date): number {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const diffMs = target.getTime() - startOfDay(today).getTime();
  return Math.round(diffMs / 86400000);
}

/** An item due a look — already expired, or expiring within a week. */
export interface AttentionEntry {
  index: number;
  item: Item;
  days: number;
  badge: string;
  urgent: boolean;
}

const ATTENTION_WINDOW_DAYS = 7;

/**
 * Items that need a look: expired, or expiring within the next week.
 * This is what turns the "Needs attention" tab on — it never appears for
 * a fresh account with no expiry dates set.
 */
export function getAttentionEntries(items: Item[], today: Date = new Date()): AttentionEntry[] {
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.expiry)
    .map(({ item, index }) => {
      const days = daysUntil(item.expiry, today);
      const badge =
        days < 0
          ? `Expired ${Math.abs(days)}d`
          : days === 0
            ? 'Expires today'
            : days === 1
              ? 'Due tomorrow'
              : `${days} days`;
      return { index, item, days, badge, urgent: days <= 0 };
    })
    .filter((entry) => entry.days <= ATTENTION_WINDOW_DAYS)
    .sort((a, b) => a.days - b.days);
}
