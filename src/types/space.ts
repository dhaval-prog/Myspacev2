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

/** A single filed belonging. */
export interface Item {
  name: string;
  category: string;
  room: string;
  /** ISO yyyy-mm-dd, or '' when no expiry was set. */
  expiry: string;
  mono: string;
}
