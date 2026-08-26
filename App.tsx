import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFonts } from '@expo-google-fonts/figtree';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { colors, fontsToLoad } from './src/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SpaceProvider } from './src/context/SpaceContext';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { DetailScreen } from './src/screens/DetailScreen';
import { ExpensesScreen } from './src/screens/expenses/ExpensesScreen';
import { SplitScreen } from './src/screens/split/SplitScreen';
import type { ViewId } from './src/data/views';

SplashScreen.preventAutoHideAsync().catch(() => {});

type AuthScreen = 'login' | 'signup';
type Screen = { name: 'home' } | { name: 'detail'; viewId: ViewId } | { name: 'expenses' } | { name: 'split' };

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
    return <DetailScreen viewId={screen.viewId} onBack={() => setScreen({ name: 'home' })} />;
  }
  if (screen.name === 'expenses') {
    return <ExpensesScreen onHome={() => setScreen({ name: 'home' })} onOpenSplit={() => setScreen({ name: 'split' })} />;
  }
  if (screen.name === 'split') {
    return <SplitScreen onHome={() => setScreen({ name: 'home' })} onOpenExpenses={() => setScreen({ name: 'expenses' })} />;
  }
  return (
    <HomeScreen
      onOpenDetail={(viewId) => setScreen({ name: 'detail', viewId })}
      onOpenExpenses={() => setScreen({ name: 'expenses' })}
      onOpenSplit={() => setScreen({ name: 'split' })}
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
      <AppNavigator />
    </SpaceProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts(fontsToLoad);

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
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
