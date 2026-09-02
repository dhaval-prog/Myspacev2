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

export type MessageKind = 'text' | 'image' | 'location' | 'system';

export interface DirectMessage {
  id: string;
  connectionId: string;
  senderId: string;
  kind: MessageKind;
  /** The message body for 'text'/'system'; a caption (may be empty) for 'image'/'location'. */
  text: string;
  /** Public storage URL for 'image', a Google Maps link for 'location'; null for 'text'. */
  attachmentUrl: string | null;
  createdAt: string;
}
