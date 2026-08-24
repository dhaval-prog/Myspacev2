import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFonts } from '@expo-google-fonts/figtree';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { colors, fontsToLoad } from './src/theme';
import { SpaceProvider } from './src/context/SpaceContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { DetailScreen } from './src/screens/DetailScreen';
import type { ViewId } from './src/data/views';

SplashScreen.preventAutoHideAsync().catch(() => {});

type Screen = { name: 'home' } | { name: 'detail'; viewId: ViewId };

function RootNavigator() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  if (screen.name === 'detail') {
    return <DetailScreen viewId={screen.viewId} onBack={() => setScreen({ name: 'home' })} />;
  }
  return <HomeScreen onOpenDetail={(viewId) => setScreen({ name: 'detail', viewId })} />;
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
      <SpaceProvider>
        <View style={{ flex: 1 }} onLayout={onLayout}>
          <RootNavigator />
        </View>
      </SpaceProvider>
    </SafeAreaProvider>
  );
}
