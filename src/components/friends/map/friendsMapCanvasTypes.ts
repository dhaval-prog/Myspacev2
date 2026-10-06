import type { ReactNode } from 'react';
import type { LatLng } from '../../../utils/geo';

export interface FriendsMapCanvasPin {
  id: string;
  latitude: number;
  longitude: number;
  /** Stacking order when two pins land on (or very near) the same screen position — e.g. a
   * selected pin must paint over an unselected neighbor a few meters away, not just whichever
   * happens to iterate last. Higher paints on top. */
  zIndex: number;
}

/** An imperative camera jump — `token` must change (even to an otherwise-identical command) for
 * the canvas to re-apply it, same "bump a counter to force a re-run" convention as this app's
 * other imperative-over-declarative-props pieces. `zoom` is always in the 256px-tile convention
 * (see friendsMapMath.ts) — each canvas converts it to whatever its own map SDK expects. */
export type FriendsMapCameraCommand = { token: number } & ({ kind: 'jump'; center: LatLng; zoom: number } | { kind: 'fit'; points: LatLng[] });

export interface FriendsMapCanvasProps {
  me: LatLng | null;
  /** Already-clustered — one entry per rendered bubble (single pin or merged cluster). */
  pins: FriendsMapCanvasPin[];
  /** Positions `renderPin`'s returned node over the given pin's current screen location. */
  renderPin: (pin: FriendsMapCanvasPin) => ReactNode;
  renderMe?: () => ReactNode;
  cameraCommand: FriendsMapCameraCommand | null;
  /** Fires on every camera settle (gesture or commanded) — `zoom` in the 256px-tile convention. */
  onCameraChange: (camera: { zoom: number; center: LatLng }) => void;
}
