/** A user-added room (e.g. "Kitchen"). Rooms unlock the Add Items flow. */
export type Room = string;

/** A single filed belonging. */
export interface Item {
  name: string;
  category: string;
  room: string;
  /** ISO yyyy-mm-dd, or '' when no expiry was set. */
  expiry: string;
  mono: string;
}
