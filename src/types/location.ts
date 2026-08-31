export interface LastSeen {
  userId: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
}

export type ShareStatus = 'active' | 'ended';

/** A user's current time-boxed live location share — only meaningful while `status` is 'active' and not yet expired. */
export interface LocationShare {
  userId: string;
  status: ShareStatus;
  startedAt: string | null;
  expiresAt: string | null;
  latitude: number | null;
  longitude: number | null;
  lastUpdatedAt: string | null;
}

export type ShareDurationKey = '15m' | '1h' | '2h' | 'off';
