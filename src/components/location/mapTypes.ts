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
  onSelectPin: (userId: string) => void;
}

export interface MapCanvasHandle {
  recenter: () => void;
}
