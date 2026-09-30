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

interface ThrowScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenChats: () => void;
  onOpenAddFriend: () => void;
  initialThrowId?: string;
}

type SubScreen =
  | { name: 'home'; lockedRecipient?: { friendUserId: string; repliedToThrowId: string } }
  | { name: 'letter'; throwId: string }
  | { name: 'settings' };

function ThrowNavigator({
  onHome,
  onOpenExpenses,
  onOpenChats,
  onOpenAddFriend,
  initialThrowId,
}: {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenChats: () => void;
  onOpenAddFriend: () => void;
  initialThrowId?: string;
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
        onOpenAddFriend={onOpenAddFriend}
        onOpenSettings={() => setScreen({ name: 'settings' })}
        lockedRecipient={screen.lockedRecipient}
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

export function ThrowScreen({ onHome, onOpenExpenses, onOpenChats, onOpenAddFriend, initialThrowId }: ThrowScreenProps) {
  return (
    <ThrowProvider>
      <ThrowStoriesProvider>
        <ThrowWeatherProvider>
          <ThrowNavigator
            onHome={onHome}
            onOpenExpenses={onOpenExpenses}
            onOpenChats={onOpenChats}
            onOpenAddFriend={onOpenAddFriend}
            initialThrowId={initialThrowId}
          />
        </ThrowWeatherProvider>
      </ThrowStoriesProvider>
    </ThrowProvider>
  );
}
