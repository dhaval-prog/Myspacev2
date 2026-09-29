import type { LatLng } from '../../../utils/geo';

export interface InboxMapPin {
  id: string;
  latitude: number;
  longitude: number;
  /** The currently-open letter's own pin — larger, blue, pulsing, with a place/distance label. */
  active: boolean;
  /** "PLACE · 1,180 MI" — only ever shown for the active pin. */
  label?: string;
}

export interface InboxMapProps {
  pins: InboxMapPin[];
  /** The active contact's letters, oldest-first — joined by a dotted route line. */
  route: LatLng[];
  /** The point the camera should pan to sit at the fixed screen anchor (see inboxLayout.mapAnchor)
   * — null leaves the camera exactly where it last was (e.g. a momentarily-empty contact). */
  anchor: LatLng | null;
  isDay: boolean;
}
