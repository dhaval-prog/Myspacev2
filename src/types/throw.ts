/** A single freehand pen stroke, captured as a list of points plus the pen used to draw it. */
export interface StrokePath {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface ThrowLocation {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

export type ThrowStatus = 'thrown' | 'read' | 'replied';

/** Raw shape of a `throws` row, as returned by Supabase. */
export interface ThrowRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  message_text: string | null;
  strokes: StrokePath[] | null;
  pen_color: string | null;
  photo_url: string | null;
  photo_urls: string[] | null;
  sender_city: string;
  sender_country: string;
  sender_latitude: number;
  sender_longitude: number;
  recipient_city: string;
  recipient_country: string;
  recipient_latitude: number;
  recipient_longitude: number;
  distance_miles: number;
  status: ThrowStatus;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  replied_to_throw_id: string | null;
  deleted_by_sender: boolean;
  deleted_by_recipient: boolean;
}

/** Client-shaped letter, with the counterpart's display name resolved and a direction flag. */
export interface ThrowLetter {
  id: string;
  senderId: string;
  recipientId: string;
  counterpartId: string;
  counterpartName: string;
  counterpartAvatarUrl: string | null;
  direction: 'sent' | 'received';
  messageText: string | null;
  strokes: StrokePath[] | null;
  penColor: string | null;
  /** Every photo attached to this letter, in the order they were added — may be empty. */
  photoUrls: string[];
  senderCity: string;
  senderCountry: string;
  senderLatitude: number;
  senderLongitude: number;
  recipientCity: string;
  recipientCountry: string;
  recipientLatitude: number;
  recipientLongitude: number;
  distanceMiles: number;
  status: ThrowStatus;
  createdAt: string;
  readAt: string | null;
  repliedToThrowId: string | null;
}

/** A friend merged with their Throw location, if they've set one. */
export interface ThrowFriend {
  userId: string;
  name: string;
  avatarUrl: string | null;
  location: ThrowLocation | null;
}

export interface ComposeDraft {
  recipientId: string;
  repliedToThrowId?: string;
  messageText: string | null;
  strokes: StrokePath[] | null;
  penColor: string;
  photoUrls: string[];
}

export type AlertRecurrence = 'once' | 'everyday' | 'weekly' | 'monthly';

/** Raw shape of a `throw_alerts` row, as returned by Supabase. */
export interface ThrowAlertRow {
  id: string;
  user_id: string;
  message_text: string;
  strokes: StrokePath[] | null;
  pen_color: string | null;
  recurrence_type: AlertRecurrence;
  days_of_week: number[] | null;
  day_of_month: number | null;
  hour: number;
  minute: number;
  next_trigger_at: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** Client-shaped self-reminder — a letter you throw to yourself that fires as a full-screen
 * alert at the scheduled time instead of landing in someone else's inbox. */
export interface ThrowAlert {
  id: string;
  messageText: string;
  strokes: StrokePath[] | null;
  penColor: string | null;
  recurrence: AlertRecurrence;
  /** 0 (Sunday) – 6 (Saturday), only meaningful when recurrence is 'weekly'. */
  daysOfWeek: number[];
  /** Only meaningful when recurrence is 'monthly'. */
  dayOfMonth: number | null;
  hour: number;
  minute: number;
  nextTriggerAt: string;
  active: boolean;
}

/** The paper's time/day picker state — recomputed into an absolute `next_trigger_at` instant by
 * `computeNextTrigger` (see utils/throwAlerts.ts) every time it changes or an alert fires. */
export interface AlertSchedule {
  recurrence: AlertRecurrence;
  hour: number;
  minute: number;
  daysOfWeek: number[];
  dayOfMonth: number;
}
