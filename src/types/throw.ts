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
  /** When this location was last saved — undefined for a location loaded before this column was
   * read back (or never set). Backs the Friends Map's "live" vs "last seen" distinction. */
  updatedAt?: string;
}

/** Who can see this user's Throw location on the Friends Map — 'friends' (default) keeps the
 * existing friends-only visibility, 'all' opens it to every MySpace user, 'ghost' hides it from
 * everyone (including friends). Enforced server-side by `throw_profiles`' own RLS, not just this
 * client filtering. */
export type LocationVisibility = 'friends' | 'all' | 'ghost';

export type ThrowStatus = 'thrown' | 'read' | 'replied';

/** A watch-time trim window into a video attachment — nothing is physically re-encoded (no
 * ffmpeg/native trim module in this project, same reasoning as story videos' own trim), so this
 * just tells the player where to start and stop. */
export interface MediaTrim {
  startMs: number;
  endMs: number;
}

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
  /** Index-aligned with photo_urls — null entries mean "no trim" (a photo, or a video within the
   * 15s cap). */
  photo_trim_start_ms: number[] | null;
  photo_trim_end_ms: number[] | null;
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
  /** The sender's own optional attached reminder request (see ThrowLetter's own alertSchedule) —
   * null unless they set one via the Bell icon. */
  alert_recurrence_type: AlertRecurrence | null;
  alert_days_of_week: number[] | null;
  alert_day_of_month: number | null;
  alert_hour: number | null;
  alert_minute: number | null;
  alert_confirmed: boolean;
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
  /** Every photo/video attached to this letter, in the order they were added — may be empty. */
  photoUrls: string[];
  /** Index-aligned with photoUrls, always the same length — null entries mean "no trim" (a photo,
   * or a video within the 15s cap that never needed one). */
  photoTrims: (MediaTrim | null)[];
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
  /** The sender's own optional attached reminder request — null unless they set one via the Bell
   * icon when composing this letter. The recipient sees a Confirm button on it (see LetterFoldCard)
   * until alertConfirmed is true, at which point they have their own throw_alerts row for it. */
  alertSchedule: AlertSchedule | null;
  alertConfirmed: boolean;
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
  /** Index-aligned with photoUrls — omit (or leave every entry null) when nothing needs trimming. */
  photoTrims?: (MediaTrim | null)[];
  /** An optional reminder request to attach to this letter — omit (or null) for an ordinary letter
   * with nothing attached. See ThrowLetter's own alertSchedule for what happens once sent. */
  alertSchedule?: AlertSchedule | null;
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
