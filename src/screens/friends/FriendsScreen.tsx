import React from 'react';
import { useFriends } from '../../context/FriendsContext';
import { AddFriendScreen } from './AddFriendScreen';
import { FriendsScannerScreen } from './FriendsScannerScreen';
import { MatchFoundScreen } from './MatchFoundScreen';
import { FriendRequestsScreen } from './FriendRequestsScreen';
import { ChatsListScreen } from './ChatsListScreen';
import { ChatThreadScreen } from './ChatThreadScreen';
import { LockedThreadScreen } from './LockedThreadScreen';
import { CreateGroupScreen } from './CreateGroupScreen';
import { GroupChatScreen } from './GroupChatScreen';

interface FriendsScreenProps {
  onHome: () => void;
  /** Threaded through to the bottom nav dock on the Chats list and Add-a-friend screens. */
  onOpenExpenses: () => void;
  /** Opens Throw — both the bottom nav dock's Throw tab and the Chats list's pinned row. */
  onOpenThrow: () => void;
  /** Opens Throw straight to its inbox — also surfaced from the Chats list's pinned row. */
  onOpenThrowInbox: () => void;
  /** Opens the Games hub — also surfaced from the Chats list's pinned row. */
  onOpenGames: () => void;
}

/** The Friends & chat feature: friend requests and direct messaging, and every screen it opens.
 * There's no standalone "Friends home" page any more — the Chats list (with its "Add a friend"
 * pinned icon) is the whole feature's landing point now. */
export function FriendsScreen({ onHome, onOpenExpenses, onOpenThrow, onOpenThrowInbox, onOpenGames }: FriendsScreenProps) {
  const { page } = useFriends();
  switch (page) {
    case 'add':
      return <AddFriendScreen onHome={onHome} onOpenExpenses={onOpenExpenses} onOpenThrow={onOpenThrow} />;
    case 'scan':
      return <FriendsScannerScreen />;
    case 'match':
      return <MatchFoundScreen />;
    case 'requests':
      return <FriendRequestsScreen />;
    case 'chat':
      return <ChatThreadScreen />;
    case 'locked-chat':
      return <LockedThreadScreen />;
    case 'create-group':
      return <CreateGroupScreen />;
    case 'group-chat':
      return <GroupChatScreen />;
    default:
      return (
        <ChatsListScreen
          onHome={onHome}
          onOpenExpenses={onOpenExpenses}
          onOpenThrow={onOpenThrow}
          onOpenThrowInbox={onOpenThrowInbox}
          onOpenGames={onOpenGames}
        />
      );
  }
}
