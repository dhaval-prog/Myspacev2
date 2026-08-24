import { isoDate, monthLabel } from './attention';

export interface CalendarDay {
  key: string;
  label: string;
  iso: string | null;
  isToday: boolean;
  isPast: boolean;
}

export interface CalendarMonth {
  title: string;
  days: CalendarDay[];
}

/** Builds a Monday-first month grid, with leading blanks for alignment. */
export function buildMonth(offset: number, today: Date = new Date()): CalendarMonth {
  const base = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const total = new Date(year, month + 1, 0).getDate();
  const todayIso = isoDate(today);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const days: CalendarDay[] = [];
  for (let i = 0; i < lead; i++) {
    days.push({ key: `blank-${i}`, label: '', iso: null, isToday: false, isPast: false });
  }
  for (let d = 1; d <= total; d++) {
    const date = new Date(year, month, d);
    const iso = isoDate(date);
    days.push({
      key: iso,
      label: String(d),
      iso,
      isToday: iso === todayIso,
      isPast: date < todayStart,
    });
  }
  return { title: monthLabel(year, month), days };
}

export const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const QUICK_EXPIRY_OPTIONS = [
  { label: '+1 week', days: 7 },
  { label: '+1 month', days: 30 },
  { label: '+6 months', days: 182 },
];
