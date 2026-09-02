export type DosageType = 'ml' | 'capsules';
export type AlertType = 'daily' | 'weekly' | 'monthly';

/** A single filed belonging. */
export interface Item {
  name: string;
  category: string;
  room: string;
  /** ISO yyyy-mm-dd, or '' when no expiry was set. */
  expiry: string;
  mono: string;
  /** Medicines category only, all optional — undefined unless the user filled in dosage/reminders. */
  dosageType?: DosageType;
  dosageAmount?: number;
  remindersEnabled?: boolean;
  /** 1-4, only meaningful when remindersEnabled. */
  dosesPerDay?: number;
  /** "HH:MM" 24-hour strings, one per dose, only meaningful when remindersEnabled. */
  reminderTimes?: string[];
  /** Public URL of an optional photo taken for this item, shown in place of its category icon. */
  photoUrl?: string;
  /** "Alert" category items only — how often this reminder recurs. */
  alertType?: AlertType;
}
