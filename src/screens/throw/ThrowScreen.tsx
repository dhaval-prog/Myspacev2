import React, { useState } from 'react';
import { View } from 'react-native';
import { ThrowProvider, useThrow } from '../../context/ThrowContext';
import { throwColor } from '../../theme/throwTokens';
import { ThrowLocationSetupScreen } from './ThrowLocationSetupScreen';
import { ThrowHomeScreen } from './ThrowHomeScreen';
import { ThrowInboxScreen } from './ThrowInboxScreen';
import { ThrowLetterDetailScreen } from './ThrowLetterDetailScreen';
import { ThrowSettingsScreen } from './ThrowSettingsScreen';

interface ThrowScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenChats: () => void;
  onOpenAddFriend: () => void;
  initialThrowId?: string;
  /** Opens straight to the inbox instead of the compose map — used when arriving here via the
   * "Throw inbox" shortcut on Orbit's Chats list rather than the usual Throw entry point. */
  initialScreen?: 'inbox';
}

type SubScreen =
  | { name: 'home'; lockedRecipient?: { friendUserId: string; repliedToThrowId: string } }
  | { name: 'inbox' }
  | { name: 'letter'; throwId: string }
  | { name: 'settings' };

function ThrowNavigator({
  onHome,
  onOpenExpenses,
  onOpenChats,
  onOpenAddFriend,
  initialThrowId,
  initialScreen,
}: {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenChats: () => void;
  onOpenAddFriend: () => void;
  initialThrowId?: string;
  initialScreen?: 'inbox';
}) {
  const { loading, myLocation } = useThrow();
  const [screen, setScreen] = useState<SubScreen>(() =>
    initialThrowId ? { name: 'letter', throwId: initialThrowId } : initialScreen === 'inbox' ? { name: 'inbox' } : { name: 'home' },
  );

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: throwColor.screenBg }} />;
  }

  if (!myLocation) {
    return <ThrowLocationSetupScreen onDone={() => setScreen({ name: 'home' })} onBack={onHome} />;
  }

  if (screen.name === 'home') {
    return (
      <ThrowHomeScreen
        onHome={onHome}
        onOpenExpenses={onOpenExpenses}
        onOpenChats={onOpenChats}
        onOpenAddFriend={onOpenAddFriend}
        onOpenInbox={() => setScreen({ name: 'inbox' })}
        onOpenSettings={() => setScreen({ name: 'settings' })}
        lockedRecipient={screen.lockedRecipient}
      />
    );
  }

  if (screen.name === 'settings') {
    return <ThrowSettingsScreen onBack={() => setScreen({ name: 'home' })} />;
  }

  if (screen.name === 'inbox') {
    return <ThrowInboxScreen onBack={() => setScreen({ name: 'home' })} onOpenLetter={(throwId) => setScreen({ name: 'letter', throwId })} />;
  }

  if (screen.name === 'letter') {
    return (
      <ThrowLetterDetailScreen
        throwId={screen.throwId}
        onBack={() => setScreen({ name: 'inbox' })}
        onThrowBack={(counterpartUserId, repliedToThrowId) => setScreen({ name: 'home', lockedRecipient: { friendUserId: counterpartUserId, repliedToThrowId } })}
      />
    );
  }

  return null;
}

export function ThrowScreen({ onHome, onOpenExpenses, onOpenChats, onOpenAddFriend, initialThrowId, initialScreen }: ThrowScreenProps) {
  return (
    <ThrowProvider>
      <ThrowNavigator
        onHome={onHome}
        onOpenExpenses={onOpenExpenses}
        onOpenChats={onOpenChats}
        onOpenAddFriend={onOpenAddFriend}
        initialThrowId={initialThrowId}
        initialScreen={initialScreen}
      />
    </ThrowProvider>
  );
}
