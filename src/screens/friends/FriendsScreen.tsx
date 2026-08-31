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

interface FriendsScreenProps {
  onHome: () => void;
}

/** The Friends & chat feature: friend requests and direct messaging, and every screen it opens. */
export function FriendsScreen({ onHome }: FriendsScreenProps) {
  const { page } = useFriends();
  switch (page) {
    case 'add':
      return <AddFriendScreen />;
    case 'scan':
      return <FriendsScannerScreen />;
    case 'match':
      return <MatchFoundScreen />;
    case 'requests':
      return <FriendRequestsScreen />;
    case 'chats':
      return <ChatsListScreen />;
    case 'chat':
      return <ChatThreadScreen />;
    case 'locked-chat':
      return <LockedThreadScreen />;
    default:
      return <FriendsHomeScreen onHome={onHome} />;
  }
}
