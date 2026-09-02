/** A group chat, owned by whoever created it. */
export interface ChatGroup {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
}

export type GroupMessageKind = 'text' | 'image' | 'location' | 'poll';

export interface GroupPollOption {
  id: string;
  label: string;
  position: number;
}

export interface GroupPoll {
  id: string;
  groupId: string;
  createdBy: string;
  question: string;
  allowMultiple: boolean;
  options: GroupPollOption[];
  /** userId -> the option ids they've voted for. */
  votesByUser: Record<string, string[]>;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  kind: GroupMessageKind;
  /** The message body for 'text'; empty for 'image'/'location'/'poll'. */
  text: string;
  /** Public storage URL for 'image', a Google Maps link for 'location'; null otherwise. */
  attachmentUrl: string | null;
  /** Set only when kind is 'poll'. */
  pollId: string | null;
  createdAt: string;
}
