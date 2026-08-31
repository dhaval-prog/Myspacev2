/** A found-by-code/QR profile, before any friend request exists between us. */
export interface FriendProfile {
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

/** The relationship between the signed-in account and a matched profile. */
export type MatchRelationship = 'none' | 'self' | 'already_friends' | 'already_pending';

/** An accepted connection — a real friend. */
export interface Friend {
  connectionId: string;
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  acceptedAt: string | null;
}

/** A pending connection, from either side. */
export interface FriendRequest {
  connectionId: string;
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string;
  introMessage: string | null;
}

export interface DirectMessage {
  id: string;
  connectionId: string;
  senderId: string;
  text: string;
  createdAt: string;
}
