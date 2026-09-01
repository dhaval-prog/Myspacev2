import React from 'react';
import { useFriends } from '../../context/FriendsContext';
import { FriendsHomeScreen } from './FriendsHomeScreen';
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
  /** Threaded through to the bottom nav dock on the Friends home, Chats list, and Add-a-friend screens. */
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
}

/** The Friends & chat feature: friend requests and direct messaging, and every screen it opens. */
export function FriendsScreen({ onHome, onOpenExpenses, onOpenSplit }: FriendsScreenProps) {
  const { page } = useFriends();
  switch (page) {
    case 'add':
      return <AddFriendScreen onHome={onHome} onOpenExpenses={onOpenExpenses} onOpenSplit={onOpenSplit} />;
    case 'scan':
      return <FriendsScannerScreen />;
    case 'match':
      return <MatchFoundScreen />;
    case 'requests':
      return <FriendRequestsScreen />;
    case 'chats':
      return <ChatsListScreen onHome={onHome} onOpenExpenses={onOpenExpenses} onOpenSplit={onOpenSplit} />;
    case 'chat':
      return <ChatThreadScreen />;
    case 'locked-chat':
      return <LockedThreadScreen />;
    case 'create-group':
      return <CreateGroupScreen />;
    case 'group-chat':
      return <GroupChatScreen />;
    default:
      return <FriendsHomeScreen onHome={onHome} onOpenExpenses={onOpenExpenses} onOpenSplit={onOpenSplit} />;
  }
}
