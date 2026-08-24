import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useFonts } from '@expo-google-fonts/figtree';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { colors, fontsToLoad } from './src/theme';
import { HomeScreen } from './src/screens/HomeScreen';

SplashScreen.preventAutoHideAsync().catch(() => {});

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
      <View style={{ flex: 1 }} onLayout={onLayout}>
        <HomeScreen />
      </View>
    </SafeAreaProvider>
  );
}
