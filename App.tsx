import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFonts } from '@expo-google-fonts/figtree';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { colors, fontsToLoad } from './src/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SpaceProvider } from './src/context/SpaceContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { FriendsProvider, useFriends } from './src/context/FriendsContext';
import { CallProvider } from './src/context/CallContext';
import { GameProvider } from './src/context/GameContext';
import { CardsGameProvider } from './src/context/CardsGameContext';
import { GameStatsProvider } from './src/context/GameStatsContext';
import { CallOverlay } from './src/components/calls/CallOverlay';
import type { NotificationTarget } from './src/utils/notify';
import { LaunchIntro } from './src/components/LaunchIntro';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { DetailScreen } from './src/screens/DetailScreen';
import { ExpensesScreen } from './src/screens/expenses/ExpensesScreen';
import { SplitScreen } from './src/screens/split/SplitScreen';
import { FriendsScreen } from './src/screens/friends/FriendsScreen';
import { GamesScreen } from './src/screens/games/GamesScreen';
import { GamesDashboardScreen } from './src/screens/games/GamesDashboardScreen';
import { CardsGameScreen } from './src/screens/games/cards/CardsGameScreen';
import { LiveLocationsScreen } from './src/screens/location/LiveLocationsScreen';
import { AccountSettingsScreen } from './src/screens/account/AccountSettingsScreen';
import type { ViewId } from './src/data/views';

SplashScreen.preventAutoHideAsync().catch(() => {});

type AuthScreen = 'login' | 'signup';
type Screen =
  | { name: 'home' }
  | { name: 'detail'; viewId: ViewId; initialIndex?: number }
  | { name: 'expenses'; focusCardId?: string }
  | { name: 'split'; focusGroupId?: string }
  | { name: 'friends' }
  | { name: 'gamesHub' }
  | { name: 'games' }
  | { name: 'cards' }
  | { name: 'liveLocations' }
  | { name: 'account'; from: 'home' | 'expenses' | 'split' };

function AuthNavigator() {
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  return authScreen === 'signup' ? (
    <SignUpScreen onSwitchToLogin={() => setAuthScreen('login')} />
  ) : (
    <LoginScreen onSwitchToSignUp={() => setAuthScreen('signup')} />
  );
}

function AppNavigator() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const { openChat, openChatWithUser, receivedRequests, goRequests } = useFriends();

  const openNotificationTarget = (target: NotificationTarget) => {
    if (target.screen === 'expenses') setScreen({ name: 'expenses', focusCardId: target.cardId });
    else if (target.screen === 'split') setScreen({ name: 'split', focusGroupId: target.groupId });
    else if (target.screen === 'friends') {
      // FriendsProvider wraps this whole navigator, so its own state can be
      // pre-positioned directly — no focus prop needs threading through.
      // A still-pending request you received has no chat to open (that view
      // is only for the requester's own outgoing thread) — send it to
      // Requests, where Accept/Decline actually live, instead.
      if (receivedRequests.some((r) => r.connectionId === target.connectionId)) goRequests();
      else openChat(target.connectionId);
      setScreen({ name: 'friends' });
    } else {
      setScreen({ name: 'home' });
    }
  };

  if (screen.name === 'detail') {
    return (
      <DetailScreen
        viewId={screen.viewId}
        initialIndex={screen.initialIndex}
        onBack={() => setScreen({ name: 'home' })}
        onOpenExpenses={() => setScreen({ name: 'expenses' })}
        onOpenSplit={() => setScreen({ name: 'split' })}
      />
    );
  }
  if (screen.name === 'expenses') {
    return (
      <ExpensesScreen
        onHome={() => setScreen({ name: 'home' })}
        onOpenSplit={() => setScreen({ name: 'split' })}
        onOpenAccount={() => setScreen({ name: 'account', from: 'expenses' })}
        focusCardId={screen.focusCardId}
        onOpenNotificationTarget={openNotificationTarget}
      />
    );
  }
  if (screen.name === 'split') {
    return (
      <SplitScreen
        onHome={() => setScreen({ name: 'home' })}
        onOpenExpenses={() => setScreen({ name: 'expenses' })}
        onOpenAccount={() => setScreen({ name: 'account', from: 'split' })}
        focusGroupId={screen.focusGroupId}
        onOpenNotificationTarget={openNotificationTarget}
      />
    );
  }
  if (screen.name === 'friends') {
    return (
      <FriendsScreen
        onHome={() => setScreen({ name: 'home' })}
        onOpenExpenses={() => setScreen({ name: 'expenses' })}
        onOpenSplit={() => setScreen({ name: 'split' })}
        onOpenLiveLocations={() => setScreen({ name: 'liveLocations' })}
      />
    );
  }
  if (screen.name === 'gamesHub') {
    return (
      <GamesDashboardScreen
        onHome={() => setScreen({ name: 'home' })}
        onOpenExpenses={() => setScreen({ name: 'expenses' })}
        onOpenSplit={() => setScreen({ name: 'split' })}
        onOpenFriends={() => setScreen({ name: 'friends' })}
        onOpenNpat={() => setScreen({ name: 'games' })}
        onOpenCards={() => setScreen({ name: 'cards' })}
      />
    );
  }
  if (screen.name === 'games') {
    return (
      <GamesScreen
        onHome={() => setScreen({ name: 'gamesHub' })}
        onOpenExpenses={() => setScreen({ name: 'expenses' })}
        onOpenSplit={() => setScreen({ name: 'split' })}
      />
    );
  }
  if (screen.name === 'cards') {
    return (
      <CardsGameScreen
        onHome={() => setScreen({ name: 'gamesHub' })}
        onOpenExpenses={() => setScreen({ name: 'expenses' })}
        onOpenSplit={() => setScreen({ name: 'split' })}
      />
    );
  }
  if (screen.name === 'liveLocations') {
    return (
      <LiveLocationsScreen
        onBack={() => setScreen({ name: 'home' })}
        onOpenChat={(userId) => {
          openChatWithUser(userId);
          setScreen({ name: 'friends' });
        }}
        onOpenExpenses={() => setScreen({ name: 'expenses' })}
        onOpenSplit={() => setScreen({ name: 'split' })}
      />
    );
  }
  if (screen.name === 'account') {
    return <AccountSettingsScreen onBack={() => setScreen({ name: screen.from } as Screen)} />;
  }
  return (
    <HomeScreen
      onOpenDetail={(viewId, initialIndex) => setScreen({ name: 'detail', viewId, initialIndex })}
      onOpenExpenses={() => setScreen({ name: 'expenses' })}
      onOpenSplit={() => setScreen({ name: 'split' })}
      onOpenFriends={() => setScreen({ name: 'friends' })}
      onOpenGames={() => setScreen({ name: 'gamesHub' })}
      onOpenAccount={() => setScreen({ name: 'account', from: 'home' })}
      onOpenNotificationTarget={openNotificationTarget}
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
    <SpaceProvider>
      <NotificationsProvider>
        <FriendsProvider>
          <CallProvider>
            <GameProvider>
              <CardsGameProvider>
                <GameStatsProvider>
                  <AppNavigator />
                  <CallOverlay />
                </GameStatsProvider>
              </CardsGameProvider>
            </GameProvider>
          </CallProvider>
        </FriendsProvider>
      </NotificationsProvider>
    </SpaceProvider>
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
