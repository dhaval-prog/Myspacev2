import React from 'react';
import { useFriends } from '../../context/FriendsContext';
import { AddFriendScreen } from './AddFriendScreen';
import { FriendsScannerScreen } from './FriendsScannerScreen';
import { MatchFoundScreen } from './MatchFoundScreen';
import { FriendRequestsScreen } from './FriendRequestsScreen';
import { ChatsListScreen } from './ChatsListScreen';
import { FriendsMapScreen } from './FriendsMapScreen';
import { ChatThreadScreen } from './ChatThreadScreen';
import { LockedThreadScreen } from './LockedThreadScreen';
import { CreateGroupScreen } from './CreateGroupScreen';
import { GroupChatScreen } from './GroupChatScreen';

interface FriendsScreenProps {
  onHome: () => void;
  /** Threaded through to the bottom nav dock on the Chats list and Add-a-friend screens. */
  onOpenExpenses: () => void;
  /** Opens Throw — both the bottom nav dock's Throw tab and the Chats list's pinned row. Accepts
   * an optional contact to pre-address the compose to (the Map screen's own "Throw" action). */
  onOpenThrow: (focusContactId?: string) => void;
  /** Opens the Games hub — also surfaced from the Chats list's quick-action row. */
  onOpenGames: () => void;
  /** Opens account settings — the Chats list's menu bar "Me" tab. */
  onOpenAccount: () => void;
}

/** The Friends & chat feature: friend requests and direct messaging, and every screen it opens.
 * There's no standalone "Friends home" page any more — the Chats list (with its new-chat header
 * button opening Add a friend) is the whole feature's landing point now. */
export function FriendsScreen({ onHome, onOpenExpenses, onOpenThrow, onOpenGames, onOpenAccount }: FriendsScreenProps) {
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
    case 'map':
      return <FriendsMapScreen onOpenAccount={onOpenAccount} onOpenThrow={onOpenThrow} />;
    default:
      return <ChatsListScreen onOpenExpenses={onOpenExpenses} onOpenThrow={onOpenThrow} onOpenGames={onOpenGames} onOpenAccount={onOpenAccount} />;
  }
}
