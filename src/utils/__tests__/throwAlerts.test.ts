import { computeNextTrigger, formatAlertSchedule } from '../throwAlerts';
import type { AlertSchedule } from '../../types/throw';

const from = new Date(2026, 2, 15, 9, 30, 0, 0); // Sunday, March 15 2026, 9:30 AM local

function schedule(partial: Partial<AlertSchedule>): AlertSchedule {
  return { recurrence: 'once', hour: 9, minute: 0, daysOfWeek: [], dayOfMonth: 1, ...partial };
}

describe('computeNextTrigger', () => {
  it('"once"/"everyday" fire later today if the time has not passed yet', () => {
    const next = computeNextTrigger(schedule({ recurrence: 'once', hour: 10, minute: 0 }), from);
    expect(next).toEqual(new Date(2026, 2, 15, 10, 0, 0, 0));
  });

  it('"once"/"everyday" roll to tomorrow if the time has already passed today', () => {
    const next = computeNextTrigger(schedule({ recurrence: 'everyday', hour: 8, minute: 0 }), from);
    expect(next).toEqual(new Date(2026, 2, 16, 8, 0, 0, 0));
  });

  it('"once" at exactly `from` counts as past, not still-pending', () => {
    const next = computeNextTrigger(schedule({ recurrence: 'once', hour: 9, minute: 30 }), from);
    expect(next).toEqual(new Date(2026, 2, 16, 9, 30, 0, 0));
  });

  it('"weekly" picks the nearest selected weekday, later today if today qualifies and time has not passed', () => {
    // from is a Sunday (day 0); Sunday is selected and 10:00 hasn't passed yet.
    const next = computeNextTrigger(schedule({ recurrence: 'weekly', daysOfWeek: [0, 3], hour: 10, minute: 0 }), from);
    expect(next).toEqual(new Date(2026, 2, 15, 10, 0, 0, 0));
  });

  it('"weekly" skips today once its time has passed, landing on the next selected weekday', () => {
    // from is Sunday 9:30am; only Wednesday (3) is selected -> next Wednesday, March 18.
    const next = computeNextTrigger(schedule({ recurrence: 'weekly', daysOfWeek: [3], hour: 9, minute: 0 }), from);
    expect(next).toEqual(new Date(2026, 2, 18, 9, 0, 0, 0));
  });

  it('"weekly" with no days selected falls back to today\'s own weekday', () => {
    const next = computeNextTrigger(schedule({ recurrence: 'weekly', daysOfWeek: [], hour: 10, minute: 0 }), from);
    expect(next).toEqual(new Date(2026, 2, 15, 10, 0, 0, 0));
  });

  it('"monthly" fires this month if the day/time is still ahead', () => {
    const next = computeNextTrigger(schedule({ recurrence: 'monthly', dayOfMonth: 20, hour: 9, minute: 0 }), from);
    expect(next).toEqual(new Date(2026, 2, 20, 9, 0, 0, 0));
  });

  it('"monthly" rolls to next month once this month\'s day has passed', () => {
    const next = computeNextTrigger(schedule({ recurrence: 'monthly', dayOfMonth: 10, hour: 9, minute: 0 }), from);
    expect(next).toEqual(new Date(2026, 3, 10, 9, 0, 0, 0));
  });

  it('"monthly" clamps a day-of-month past what a short month has, instead of rolling into the next month', () => {
    // dayOfMonth 31 requested from January (31 days) — clamp doesn't kick in yet.
    const jan = new Date(2026, 0, 5, 9, 0, 0, 0);
    const next = computeNextTrigger(schedule({ recurrence: 'monthly', dayOfMonth: 31, hour: 9, minute: 0 }), jan);
    expect(next).toEqual(new Date(2026, 0, 31, 9, 0, 0, 0));

    // Once that's passed, next month (February, 28 days in 2026) clamps to the 28th, not March 3rd.
    const lateJan = new Date(2026, 0, 31, 10, 0, 0, 0);
    const nextAfter = computeNextTrigger(schedule({ recurrence: 'monthly', dayOfMonth: 31, hour: 9, minute: 0 }), lateJan);
    expect(nextAfter).toEqual(new Date(2026, 1, 28, 9, 0, 0, 0));
  });
});

describe('formatAlertSchedule', () => {
  it('formats "once"', () => {
    expect(formatAlertSchedule(schedule({ recurrence: 'once', hour: 9, minute: 30 }))).toBe('Once at 9:30 AM');
  });

  it('formats "everyday" with midnight/noon edge cases in 12-hour time', () => {
    expect(formatAlertSchedule(schedule({ recurrence: 'everyday', hour: 0, minute: 0 }))).toBe('Everyday at 12:00 AM');
    expect(formatAlertSchedule(schedule({ recurrence: 'everyday', hour: 12, minute: 0 }))).toBe('Everyday at 12:00 PM');
    expect(formatAlertSchedule(schedule({ recurrence: 'everyday', hour: 13, minute: 5 }))).toBe('Everyday at 1:05 PM');
  });

  it('formats "weekly" with sorted day labels', () => {
    expect(formatAlertSchedule(schedule({ recurrence: 'weekly', daysOfWeek: [3, 0], hour: 8, minute: 0 }))).toBe('Every Sun, Wed at 8:00 AM');
  });

  it('formats "monthly"', () => {
    expect(formatAlertSchedule(schedule({ recurrence: 'monthly', dayOfMonth: 15, hour: 18, minute: 15 }))).toBe('Monthly on day 15 at 6:15 PM');
  });
});
