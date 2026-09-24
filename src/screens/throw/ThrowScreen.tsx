import React, { useState } from 'react';
import { View } from 'react-native';
import { ThrowProvider, useThrow } from '../../context/ThrowContext';
import { throwColor } from '../../theme/throwTokens';
import { ThrowLocationSetupScreen } from './ThrowLocationSetupScreen';
import { ThrowHomeScreen } from './ThrowHomeScreen';
import { ThrowContactPickerScreen } from './ThrowContactPickerScreen';
import { ThrowComposeScreen } from './ThrowComposeScreen';
import { ThrowPreviewScreen } from './ThrowPreviewScreen';
import { ThrowFlightScreen } from './ThrowFlightScreen';
import { ThrowInboxScreen } from './ThrowInboxScreen';
import { ThrowLetterDetailScreen } from './ThrowLetterDetailScreen';
import { haversineMiles } from '../../utils/geo';
import type { StrokePath, ThrowLetter } from '../../types/throw';

interface ThrowScreenProps {
  onHome: () => void;
  initialThrowId?: string;
}

type SubScreen =
  | { name: 'home' }
  | { name: 'picker' }
  | { name: 'compose'; friendUserId: string; repliedToThrowId?: string }
  | { name: 'preview'; friendUserId: string; content: { messageText: string | null; strokes: StrokePath[] | null; penColor: string }; repliedToThrowId?: string }
  | { name: 'flight'; letter: ThrowLetter }
  | { name: 'inbox' }
  | { name: 'letter'; throwId: string };

function ThrowNavigator({ onHome, initialThrowId }: { onHome: () => void; initialThrowId?: string }) {
  const { loading, myLocation, friends, sendThrow } = useThrow();
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
        onOpenPicker={() => setScreen({ name: 'picker' })}
        onOpenComposeWith={(friendUserId) => setScreen({ name: 'compose', friendUserId })}
        onOpenInbox={() => setScreen({ name: 'inbox' })}
      />
    );
  }

  if (screen.name === 'picker') {
    return (
      <ThrowContactPickerScreen onBack={() => setScreen({ name: 'home' })} onSelect={(friendUserId) => setScreen({ name: 'compose', friendUserId })} />
    );
  }

  if (screen.name === 'compose') {
    const friend = friends.find((f) => f.userId === screen.friendUserId);
    if (!friend || !friend.location) {
      setScreen({ name: 'home' });
      return null;
    }
    return (
      <ThrowComposeScreen
        recipientName={friend.name}
        recipientCity={`${friend.location.city}, ${friend.location.country}`}
        onBack={() => setScreen({ name: 'home' })}
        onDone={(content) => setScreen({ name: 'preview', friendUserId: screen.friendUserId, content, repliedToThrowId: screen.repliedToThrowId })}
      />
    );
  }

  if (screen.name === 'preview') {
    const friend = friends.find((f) => f.userId === screen.friendUserId);
    if (!friend || !friend.location || !myLocation) {
      setScreen({ name: 'home' });
      return null;
    }
    const distanceMiles = haversineMiles(myLocation, friend.location);
    return (
      <ThrowPreviewScreen
        recipientName={friend.name}
        recipientCity={friend.location.city}
        recipientCountry={friend.location.country}
        distanceMiles={distanceMiles}
        content={screen.content}
        onBack={() => setScreen({ name: 'compose', friendUserId: screen.friendUserId, repliedToThrowId: screen.repliedToThrowId })}
        throwLabel={screen.repliedToThrowId ? 'THROW BACK' : 'THROW'}
        onThrow={async () => {
          const { error, letter } = await sendThrow({
            recipientId: screen.friendUserId,
            messageText: screen.content.messageText,
            strokes: screen.content.strokes,
            penColor: screen.content.penColor,
            repliedToThrowId: screen.repliedToThrowId,
          });
          if (error || !letter) return { error: error ?? 'could not send' };
          setScreen({ name: 'flight', letter });
          return { error: null };
        }}
      />
    );
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
        onThrowBack={(counterpartUserId, repliedToThrowId) => setScreen({ name: 'compose', friendUserId: counterpartUserId, repliedToThrowId })}
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
