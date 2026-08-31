/**
 * A user-added room. `category` is the fixed ROOM_OPTIONS slot it was
 * created under and never changes; `label` is the mutable display name
 * (defaults to the category, changes on rename). Locking a category in the
 * room picker checks `category`, not `label`, so a rename can't silently
 * free up the slot while the room itself is still in use.
 */
export interface Room {
  id: string;
  category: string;
  label: string;
}

export type DosageType = 'ml' | 'capsules';

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
}
