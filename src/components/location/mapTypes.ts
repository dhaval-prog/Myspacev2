/** One friend's map presence — a real coordinate only when they've actually shared last-seen or a live location. */
export interface MapPin {
  userId: string;
  name: string;
  /** True only for an actual active, unexpired location share — not just "online". */
  live: boolean;
  latitude: number | null;
  longitude: number | null;
}

export interface MapCanvasProps {
  pins: MapPin[];
  myPosition: { latitude: number; longitude: number } | null;
  /** True only while this account has an active, unexpired share of its own. */
  amSharing: boolean;
  /** GPS accuracy radius in meters for `myPosition`, when known — drawn as a soft ring around the "You" pin. */
  myAccuracy?: number | null;
  /**
   * Height, in pixels, of opaque UI docked to the bottom of the map (the
   * "Nearby friends" sheet) — auto-fit/recenter keeps pins clear of this
   * band instead of centering them right behind it.
   */
  bottomInset?: number;
  /**
   * A straight "as the crow flies" path to draw and auto-fit to — not a
   * real turn-by-turn route (that needs a paid/keyed directions API this
   * app doesn't have), just origin + destination.
   */
  routeCoords?: { latitude: number; longitude: number }[] | null;
  onSelectPin: (userId: string) => void;
}

export interface MapCanvasHandle {
  recenter: () => void;
}
