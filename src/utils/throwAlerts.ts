import type { AlertSchedule } from '../types/throw';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** The next absolute instant this schedule should fire, strictly after `from` (defaults to now)
 * — all recurrence math lives here, client-side, rather than in Expo's own native DAILY/WEEKLY/
 * MONTHLY trigger types, so a single recomputed `SchedulableTriggerInputTypes.DATE` trigger is
 * all the notification layer ever needs to know about (see ThrowAlertsContext). */
export function computeNextTrigger(schedule: AlertSchedule, from: Date = new Date()): Date {
  const isPast = (d: Date) => d.getTime() <= from.getTime();

  if (schedule.recurrence === 'weekly') {
    const days = schedule.daysOfWeek.length > 0 ? schedule.daysOfWeek : [from.getDay()];
    for (let i = 0; i < 8; i++) {
      const candidate = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i, schedule.hour, schedule.minute, 0, 0);
      if (days.includes(candidate.getDay()) && !isPast(candidate)) return candidate;
    }
    // Unreachable (every weekday is checked within one week), but keeps the return type total.
    return new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7, schedule.hour, schedule.minute, 0, 0);
  }

  if (schedule.recurrence === 'monthly') {
    const dom = schedule.dayOfMonth ?? from.getDate();
    let year = from.getFullYear();
    let month = from.getMonth();
    let candidate = new Date(year, month, Math.min(dom, daysInMonth(year, month)), schedule.hour, schedule.minute, 0, 0);
    if (isPast(candidate)) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      candidate = new Date(year, month, Math.min(dom, daysInMonth(year, month)), schedule.hour, schedule.minute, 0, 0);
    }
    return candidate;
  }

  // 'once' and 'everyday' both just mean "the next time this clock time comes around".
  let candidate = new Date(from.getFullYear(), from.getMonth(), from.getDate(), schedule.hour, schedule.minute, 0, 0);
  if (isPast(candidate)) candidate = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1, schedule.hour, schedule.minute, 0, 0);
  return candidate;
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = ((hour + 11) % 12) + 1;
  return `${h12}:${String(minute).padStart(2, '0')} ${period}`;
}

/** A short human summary of the schedule, e.g. "Every Mon, Wed at 9:30 AM" — used both on the
 * paper itself and in the inbox's Reminders row. */
export function formatAlertSchedule(schedule: AlertSchedule): string {
  const time = formatTime(schedule.hour, schedule.minute);
  switch (schedule.recurrence) {
    case 'once':
      return `Once at ${time}`;
    case 'everyday':
      return `Everyday at ${time}`;
    case 'weekly': {
      const days = schedule.daysOfWeek.length > 0 ? [...schedule.daysOfWeek].sort().map((d) => WEEKDAY_LABELS[d]).join(', ') : 'every day';
      return `Every ${days} at ${time}`;
    }
    case 'monthly':
      return `Monthly on day ${schedule.dayOfMonth} at ${time}`;
  }
}

export { WEEKDAY_LABELS };
