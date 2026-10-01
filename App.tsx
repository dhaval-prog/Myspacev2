import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFonts } from '@expo-google-fonts/figtree';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { colors, fontsToLoad } from './src/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { FriendsProvider, useFriends } from './src/context/FriendsContext';
import { CallProvider } from './src/context/CallContext';
import { GameProvider } from './src/context/GameContext';
import { TriviaGameProvider } from './src/context/TriviaGameContext';
import { GameStatsProvider } from './src/context/GameStatsContext';
import { ThrowAlertsProvider, ThrowAlertsOverlay } from './src/context/ThrowAlertsContext';
import { ThrowColorModeProvider } from './src/context/ThrowColorModeContext';
import { CallOverlay } from './src/components/calls/CallOverlay';
import type { NotificationTarget } from './src/utils/notify';
import { LaunchIntro } from './src/components/LaunchIntro';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { ExpensesScreen } from './src/screens/expenses/ExpensesScreen';
import { FriendsScreen } from './src/screens/friends/FriendsScreen';
import { GamesScreen } from './src/screens/games/GamesScreen';
import { GamesDashboardScreen } from './src/screens/games/GamesDashboardScreen';
import { TriviaGameScreen } from './src/screens/games/trivia/TriviaGameScreen';
import { ThrowScreen } from './src/screens/throw/ThrowScreen';
import { ThrowReceivedLettersScreen } from './src/screens/throw/ThrowReceivedLettersScreen';
import { AccountSettingsScreen } from './src/screens/account/AccountSettingsScreen';

SplashScreen.preventAutoHideAsync().catch(() => {});

type AuthScreen = 'login' | 'signup';
type Screen =
  | { name: 'expenses'; focusCardId?: string }
  | { name: 'friends' }
  | { name: 'gamesHub' }
  | { name: 'games'; initialTab?: 'create' | 'join' }
  | { name: 'trivia'; initialTab?: 'create' | 'join' }
  | { name: 'throw'; openThrowId?: string; focusContactId?: string }
  | { name: 'throwLetters'; contactId?: string }
  | { name: 'account' };

function AuthNavigator() {
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  return authScreen === 'signup' ? (
    <SignUpScreen onSwitchToLogin={() => setAuthScreen('login')} />
  ) : (
    <LoginScreen onSwitchToSignUp={() => setAuthScreen('signup')} />
  );
}

function AppNavigator() {
  // Throw is the app's landing point now — no standalone Home screen any more, and Chat no longer
  // doubles as the default either (see navItems.ts's own reordering to Throw/Chat/Pocket).
  const [screen, setScreen] = useState<Screen>({ name: 'throw' });
  const { openChat, receivedRequests, goRequests, goChats, goAdd } = useFriends();

  const openNotificationTarget = (target: NotificationTarget) => {
    if (target.screen === 'expenses') setScreen({ name: 'expenses', focusCardId: target.cardId });
    else if (target.screen === 'friends') {
      // FriendsProvider wraps this whole navigator, so its own state can be
      // pre-positioned directly — no focus prop needs threading through.
      // A still-pending request you received has no chat to open (that view
      // is only for the requester's own outgoing thread) — send it to
      // Requests, where Accept/Decline actually live, instead.
      if (receivedRequests.some((r) => r.connectionId === target.connectionId)) goRequests();
      else openChat(target.connectionId);
      setScreen({ name: 'friends' });
    } else if (target.screen === 'throw' && 'throwId' in target) {
      setScreen({ name: 'throw', openThrowId: target.throwId });
    } else if (target.screen === 'throw' && 'focusContactId' in target) {
      setScreen({ name: 'throw', focusContactId: target.focusContactId });
    } else {
      setScreen({ name: 'throw' });
    }
  };

  if (screen.name === 'expenses') {
    return (
      <ExpensesScreen
        onHome={() => setScreen({ name: 'throw' })}
        onOpenThrow={() => setScreen({ name: 'throw' })}
        onOpenAccount={() => setScreen({ name: 'account' })}
        focusCardId={screen.focusCardId}
        onOpenNotificationTarget={openNotificationTarget}
      />
    );
  }
  if (screen.name === 'gamesHub') {
    return (
      <GamesDashboardScreen
        onHome={() => setScreen({ name: 'throw' })}
        onOpenExpenses={() => setScreen({ name: 'expenses' })}
        onOpenThrow={() => setScreen({ name: 'throw' })}
        onOpenFriends={() => setScreen({ name: 'friends' })}
        onOpenNpat={(initialTab) => setScreen({ name: 'games', initialTab })}
        onOpenTrivia={(initialTab) => setScreen({ name: 'trivia', initialTab })}
      />
    );
  }
  if (screen.name === 'games') {
    return (
      <GamesScreen
        onHome={() => setScreen({ name: 'gamesHub' })}
        onOpenExpenses={() => setScreen({ name: 'expenses' })}
        onOpenThrow={() => setScreen({ name: 'throw' })}
        initialTab={screen.initialTab}
      />
    );
  }
  if (screen.name === 'trivia') {
    return (
      <TriviaGameScreen
        onHome={() => setScreen({ name: 'gamesHub' })}
        onOpenExpenses={() => setScreen({ name: 'expenses' })}
        onOpenThrow={() => setScreen({ name: 'throw' })}
        initialTab={screen.initialTab}
      />
    );
  }
  if (screen.name === 'account') {
    return <AccountSettingsScreen onBack={() => setScreen({ name: 'expenses' })} />;
  }
  if (screen.name === 'friends') {
    return (
      <FriendsScreen
        onHome={() => setScreen({ name: 'throw' })}
        onOpenExpenses={() => setScreen({ name: 'expenses' })}
        onOpenThrow={() => setScreen({ name: 'throw' })}
        onOpenGames={() => setScreen({ name: 'gamesHub' })}
        onOpenReceivedLetters={() => setScreen({ name: 'throwLetters' })}
      />
    );
  }
  if (screen.name === 'throwLetters') {
    return (
      <ThrowReceivedLettersScreen
        onBack={() => setScreen({ name: 'friends' })}
        // Reply lands on Throw's own existing compose flow for that contact — there's no separate
        // "ThrowCompose" route in this app (Throw already composes in place once a contact is
        // focused), so this reuses the same `focusContactId` navigation a notification tap uses.
        onReply={(contactId) => setScreen({ name: 'throw', focusContactId: contactId })}
        initialContactId={screen.contactId}
      />
    );
  }
  return (
    <ThrowScreen
      onHome={() => setScreen({ name: 'throw' })}
      onOpenExpenses={() => setScreen({ name: 'expenses' })}
      onOpenChats={() => {
        goChats();
        setScreen({ name: 'friends' });
      }}
      onOpenAddFriendScreen={() => {
        goAdd();
        setScreen({ name: 'friends' });
      }}
      onNotificationTarget={openNotificationTarget}
      initialThrowId={screen.name === 'throw' ? screen.openThrowId : undefined}
      initialFocusContactId={screen.name === 'throw' ? screen.focusContactId : undefined}
    />
  );
}

function RootNavigator() {
  const { session, initializing } = useAuth();

  if (initializing) {
    return <View style={{ flex: 1, backgroundColor: colors.lime }} />;
  }

  if (!session) {
    return <AuthNavigator />;
  }

  return (
    <NotificationsProvider>
      <FriendsProvider>
        <CallProvider>
          <GameProvider>
            <TriviaGameProvider>
              <GameStatsProvider>
                <ThrowColorModeProvider>
                  <ThrowAlertsProvider>
                    <AppNavigator />
                    <CallOverlay />
                    <ThrowAlertsOverlay />
                  </ThrowAlertsProvider>
                </ThrowColorModeProvider>
              </GameStatsProvider>
            </TriviaGameProvider>
          </GameProvider>
        </CallProvider>
      </FriendsProvider>
    </NotificationsProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts(fontsToLoad);
  // Plays once right after the native (static) launch screen hands off,
  // over the real app underneath — see LaunchIntro for why this can't
  // live in the native launch screen itself (it can only ever be static).
  const [introDone, setIntroDone] = useState(false);

  const onLayout = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.lime }} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={{ flex: 1 }} onLayout={onLayout}>
          <RootNavigator />
          {!introDone && <LaunchIntro onDone={() => setIntroDone(true)} />}
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
