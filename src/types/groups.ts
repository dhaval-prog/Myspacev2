/** A group chat, owned by whoever created it. */
export interface ChatGroup {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
}

export type GroupMessageKind = 'text' | 'image' | 'location' | 'poll' | 'system';

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
  /** 'rename' polls are auto-created by proposeGroupRename and drive the group's name; a plain member-made poll is 'general'. */
  purpose: 'general' | 'rename';
  /** Set only for a 'rename' poll: the name it's asking to switch to / away from. */
  proposedName: string | null;
  oldName: string | null;
  /** Set only for a 'rename' poll: when it auto-resolves if no majority is reached first. */
  expiresAt: string | null;
  resolved: boolean;
  resolution: 'renamed' | 'kept' | null;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  kind: GroupMessageKind;
  /** The message body for 'text'/'system'; empty for 'image'/'location'/'poll'. */
  text: string;
  /** Public storage URL for 'image', a Google Maps link for 'location'; null otherwise. */
  attachmentUrl: string | null;
  /** Set only when kind is 'poll'. */
  pollId: string | null;
  createdAt: string;
}
