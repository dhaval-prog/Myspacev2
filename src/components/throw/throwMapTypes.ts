import type { LatLng } from '../../utils/geo';

export interface ThrowMapPin {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  isSelf?: boolean;
  /** The currently-selected recipient — emphasized with a glowing ring. */
  selected?: boolean;
  /** A friend who isn't the current selection — faded so the selected one reads clearly. */
  dimmed?: boolean;
  onPress?: () => void;
}

export interface ThrowMapRoute {
  points: LatLng[];
  /** 0..1 progress along `points` — drives the flying plane marker's position and heading. */
  progress: number;
  showPlane?: boolean;
}

export interface ThrowMapProps {
  pins: ThrowMapPin[];
  /** Center the map on this single point (the home screen's "zoom to selected contact"). Ignored once `fitPoints` is set. */
  focus?: LatLng | null;
  /** Fit the viewport to include every one of these points at once (the flight screen framing both endpoints). Takes priority over `focus`. */
  fitPoints?: LatLng[] | null;
  route?: ThrowMapRoute | null;
}
