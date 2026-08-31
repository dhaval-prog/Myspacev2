/** A found-by-code/QR profile, before any friend request exists between us. */
export interface FriendProfile {
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

/** An accepted connection — a real friend. */
export interface Friend {
  connectionId: string;
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

/** A pending connection, from either side. */
export interface FriendRequest {
  connectionId: string;
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface DirectMessage {
  id: string;
  connectionId: string;
  senderId: string;
  text: string;
  createdAt: string;
}
