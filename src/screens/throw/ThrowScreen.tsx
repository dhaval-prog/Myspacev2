import React, { useState } from 'react';
import { View } from 'react-native';
import { ThrowProvider, useThrow } from '../../context/ThrowContext';
import { ThrowStoriesProvider } from '../../context/ThrowStoriesContext';
import { ThrowWeatherProvider } from '../../context/ThrowWeatherContext';
import { throwColor } from '../../theme/throwTokens';
import { ThrowLocationSetupScreen } from './ThrowLocationSetupScreen';
import { ThrowHomeScreen } from './ThrowHomeScreen';
import { ThrowLetterDetailScreen } from './ThrowLetterDetailScreen';
import { ThrowSettingsScreen } from './ThrowSettingsScreen';
import type { NotificationTarget } from '../../utils/notify';

interface ThrowScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenChats: () => void;
  onOpenAddFriendScreen: () => void;
  onNotificationTarget: (target: NotificationTarget) => void;
  onOpenReceivedLetters: (contactId?: string, opts?: { viaToast?: boolean }) => void;
  initialThrowId?: string;
  initialFocusContactId?: string;
}

type SubScreen =
  | { name: 'home'; lockedRecipient?: { friendUserId: string; repliedToThrowId: string } }
  | { name: 'letter'; throwId: string }
  | { name: 'settings' };

function ThrowNavigator({
  onHome,
  onOpenExpenses,
  onOpenChats,
  onOpenAddFriendScreen,
  onNotificationTarget,
  onOpenReceivedLetters,
  initialThrowId,
  initialFocusContactId,
}: {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenChats: () => void;
  onOpenAddFriendScreen: () => void;
  onNotificationTarget: (target: NotificationTarget) => void;
  onOpenReceivedLetters: (contactId?: string, opts?: { viaToast?: boolean }) => void;
  initialThrowId?: string;
  initialFocusContactId?: string;
}) {
  const { loading, myLocation } = useThrow();
  const [screen, setScreen] = useState<SubScreen>(() => (initialThrowId ? { name: 'letter', throwId: initialThrowId } : { name: 'home' }));

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: throwColor.screenBg }} />;
  }

  if (!myLocation) {
    return <ThrowLocationSetupScreen onDone={() => setScreen({ name: 'home' })} onBack={onHome} />;
  }

  if (screen.name === 'home') {
    return (
      <ThrowHomeScreen
        onOpenExpenses={onOpenExpenses}
        onOpenChats={onOpenChats}
        onOpenSettings={() => setScreen({ name: 'settings' })}
        // "Open this exact letter" is this navigator's own subscreen switch (ThrowHomeScreen has
        // no notion of it), so it's intercepted right here — anything else (focusing a contact,
        // or leaving Throw entirely for Expenses/Friends) is ThrowHomeScreen's own concern, passed
        // straight through.
        onOpenThrowLetter={(throwId) => setScreen({ name: 'letter', throwId })}
        onOpenAddFriendScreen={onOpenAddFriendScreen}
        onNotificationTarget={onNotificationTarget}
        onOpenReceivedLetters={onOpenReceivedLetters}
        lockedRecipient={screen.lockedRecipient}
        initialFocusContactId={initialFocusContactId}
      />
    );
  }

  if (screen.name === 'settings') {
    return <ThrowSettingsScreen onBack={() => setScreen({ name: 'home' })} />;
  }

  if (screen.name === 'letter') {
    return (
      <ThrowLetterDetailScreen
        throwId={screen.throwId}
        onBack={() => setScreen({ name: 'home' })}
        onThrowBack={(counterpartUserId, repliedToThrowId) => setScreen({ name: 'home', lockedRecipient: { friendUserId: counterpartUserId, repliedToThrowId } })}
      />
    );
  }

  return null;
}

export function ThrowScreen({ onHome, onOpenExpenses, onOpenChats, onOpenAddFriendScreen, onNotificationTarget, onOpenReceivedLetters, initialThrowId, initialFocusContactId }: ThrowScreenProps) {
  return (
    <ThrowProvider>
      <ThrowStoriesProvider>
        <ThrowWeatherProvider>
          <ThrowNavigator
            onHome={onHome}
            onOpenExpenses={onOpenExpenses}
            onOpenChats={onOpenChats}
            onOpenAddFriendScreen={onOpenAddFriendScreen}
            onNotificationTarget={onNotificationTarget}
            onOpenReceivedLetters={onOpenReceivedLetters}
            initialThrowId={initialThrowId}
            initialFocusContactId={initialFocusContactId}
          />
        </ThrowWeatherProvider>
      </ThrowStoriesProvider>
    </ThrowProvider>
  );
}
