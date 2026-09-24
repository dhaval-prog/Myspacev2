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
  /** 0..1 progress along `points` — drives the flying plane marker's position, heading, and
   * on-screen size (large near the start of `points`, small near the end). */
  progress: number;
  showPlane?: boolean;
  /** True for the brief window right after the plane reaches the end of `points` — draws a
   * one-shot landing pulse at that final point instead of/alongside the plane. */
  landing?: boolean;
}

export interface ThrowMapProps {
  pins: ThrowMapPin[];
  /** Center the map on this single point (the home screen's "zoom to selected contact"). Ignored once `fitPoints` is set. */
  focus?: LatLng | null;
  /** Fit the viewport to include every one of these points at once (the flight screen framing both endpoints). Takes priority over `focus`. */
  fitPoints?: LatLng[] | null;
  route?: ThrowMapRoute | null;
}
