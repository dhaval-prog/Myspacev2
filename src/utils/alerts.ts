import type { AlertType } from '../types/space';
import { isoDate } from './attention';

export const ALERT_TYPES: AlertType[] = ['daily', 'weekly', 'monthly'];

export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

/**
 * The next date this alert is due, given its recurrence — reuses the same
 * `expiry` field (and the "Needs attention" window built around it) that
 * perishable items already have, rather than a separate scheduling system.
 */
export function nextAlertDate(type: AlertType, from: Date = new Date()): string {
  const d = new Date(from);
  if (type === 'weekly') d.setDate(d.getDate() + 7);
  else if (type === 'monthly') d.setMonth(d.getMonth() + 1);
  return isoDate(d);
}
