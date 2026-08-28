import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFonts } from '@expo-google-fonts/figtree';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { colors, fontsToLoad } from './src/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SpaceProvider } from './src/context/SpaceContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { LaunchIntro } from './src/components/LaunchIntro';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { DetailScreen } from './src/screens/DetailScreen';
import { ExpensesScreen } from './src/screens/expenses/ExpensesScreen';
import { SplitScreen } from './src/screens/split/SplitScreen';
import { AccountSettingsScreen } from './src/screens/account/AccountSettingsScreen';
import type { ViewId } from './src/data/views';

SplashScreen.preventAutoHideAsync().catch(() => {});

type AuthScreen = 'login' | 'signup';
type Screen =
  | { name: 'home' }
  | { name: 'detail'; viewId: ViewId; initialIndex?: number }
  | { name: 'expenses' }
  | { name: 'split' }
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

  if (screen.name === 'detail') {
    return (
      <DetailScreen
        viewId={screen.viewId}
        initialIndex={screen.initialIndex}
        onBack={() => setScreen({ name: 'home' })}
      />
    );
  }
  if (screen.name === 'expenses') {
    return (
      <ExpensesScreen
        onHome={() => setScreen({ name: 'home' })}
        onOpenSplit={() => setScreen({ name: 'split' })}
        onOpenAccount={() => setScreen({ name: 'account', from: 'expenses' })}
      />
    );
  }
  if (screen.name === 'split') {
    return (
      <SplitScreen
        onHome={() => setScreen({ name: 'home' })}
        onOpenExpenses={() => setScreen({ name: 'expenses' })}
        onOpenAccount={() => setScreen({ name: 'account', from: 'split' })}
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
      onOpenAccount={() => setScreen({ name: 'account', from: 'home' })}
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
        <AppNavigator />
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
