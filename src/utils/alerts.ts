import type { AlertType } from '../types/space';
import { isoDate } from './attention';

export const ALERT_TYPES: AlertType[] = ['daily', 'weekly', 'monthly'];

export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

/**
 * The alert's first due date, given its recurrence — reuses the same
 * `expiry` field (and the "Needs attention" window built around it) that
 * perishable items already have, rather than a separate scheduling system.
 * A brand-new alert is due right away regardless of type; it only starts
 * advancing by its interval once it's resolved (see `recurAlertDate`).
 */
export function nextAlertDate(type: AlertType, from: Date = new Date()): string {
  const d = new Date(from);
  if (type === 'weekly') d.setDate(d.getDate() + 7);
  else if (type === 'monthly') d.setMonth(d.getMonth() + 1);
  return isoDate(d);
}

/**
 * The next occurrence strictly after `from` — used when a Daily/Weekly/
 * Monthly alert is marked used, so it comes back instead of disappearing
 * for good like a one-off item.
 */
export function recurAlertDate(type: AlertType, from: Date = new Date()): string {
  const d = new Date(from);
  if (type === 'weekly') d.setDate(d.getDate() + 7);
  else if (type === 'monthly') d.setMonth(d.getMonth() + 1);
  else d.setDate(d.getDate() + 1);
  return isoDate(d);
}
