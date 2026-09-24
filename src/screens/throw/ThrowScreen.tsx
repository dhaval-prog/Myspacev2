import React, { useState } from 'react';
import { View } from 'react-native';
import { ThrowProvider, useThrow } from '../../context/ThrowContext';
import { throwColor } from '../../theme/throwTokens';
import { ThrowLocationSetupScreen } from './ThrowLocationSetupScreen';
import { ThrowHomeScreen } from './ThrowHomeScreen';
import { ThrowFlightScreen } from './ThrowFlightScreen';
import { ThrowInboxScreen } from './ThrowInboxScreen';
import { ThrowLetterDetailScreen } from './ThrowLetterDetailScreen';
import type { ThrowLetter } from '../../types/throw';

interface ThrowScreenProps {
  onHome: () => void;
  initialThrowId?: string;
}

type SubScreen =
  | { name: 'home'; lockedRecipient?: { friendUserId: string; repliedToThrowId: string } }
  | { name: 'flight'; letter: ThrowLetter }
  | { name: 'inbox' }
  | { name: 'letter'; throwId: string }
  | { name: 'settings' };

function ThrowNavigator({ onHome, initialThrowId }: { onHome: () => void; initialThrowId?: string }) {
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
        onHome={onHome}
        onOpenInbox={() => setScreen({ name: 'inbox' })}
        onOpenSettings={() => setScreen({ name: 'settings' })}
        onThrown={(letter) => setScreen({ name: 'flight', letter })}
        lockedRecipient={screen.lockedRecipient}
      />
    );
  }

  if (screen.name === 'settings') {
    return <ThrowLocationSetupScreen mode="edit" onDone={() => setScreen({ name: 'home' })} onBack={() => setScreen({ name: 'home' })} />;
  }

  if (screen.name === 'flight') {
    const l = screen.letter;
    return (
      <ThrowFlightScreen
        recipientName={l.counterpartName}
        recipientCity={l.recipientCity}
        recipientCountry={l.recipientCountry}
        distanceMiles={l.distanceMiles}
        from={{ latitude: l.senderLatitude, longitude: l.senderLongitude }}
        to={{ latitude: l.recipientLatitude, longitude: l.recipientLongitude }}
        onDone={() => setScreen({ name: 'home' })}
      />
    );
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

export function ThrowScreen({ onHome, initialThrowId }: ThrowScreenProps) {
  return (
    <ThrowProvider>
      <ThrowNavigator onHome={onHome} initialThrowId={initialThrowId} />
    </ThrowProvider>
  );
}
