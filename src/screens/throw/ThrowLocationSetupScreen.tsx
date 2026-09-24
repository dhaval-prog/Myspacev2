import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { throwColor, throwFont, throwRadius, throwSpace } from '../../theme/throwTokens';
import { nearestThrowCity, searchThrowCities, type ThrowCity } from '../../utils/throwCities';
import { useThrow } from '../../context/ThrowContext';

interface ThrowLocationSetupScreenProps {
  onDone: () => void;
  onBack?: () => void;
}

export function ThrowLocationSetupScreen({ onDone, onBack }: ThrowLocationSetupScreenProps) {
  const insets = useSafeAreaInsets();
  const { setMyLocation } = useThrow();
  const [showManual, setShowManual] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const results = searchThrowCities(query, 40);

  const chooseCity = async (city: ThrowCity) => {
    const { error: err } = await setMyLocation(city);
    if (err) setError(err);
    else onDone();
  };

  const requestDeviceLocation = async () => {
    setError(null);
    setRequesting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setShowManual(true);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      let city: ThrowCity | null = null;
      try {
        const geocoded = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        const first = geocoded[0];
        if (first?.city && first?.country) {
          city = { city: first.city, country: first.country, latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        }
      } catch {
        // Reverse geocoding isn't available on this platform (e.g. web) — fall back below.
      }
      if (!city) city = nearestThrowCity(pos.coords.latitude, pos.coords.longitude);
      await chooseCity(city);
    } catch {
      setShowManual(true);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      {onBack && (
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backLabel}>Cancel</Text>
        </Pressable>
      )}

      {!showManual ? (
        <View style={styles.center}>
          <Text style={styles.title}>Let Throw know where you are</Text>
          <Text style={styles.body}>Your location helps your letters travel from where you are to where your friends are.</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable onPress={requestDeviceLocation} disabled={requesting}>
            <View style={styles.primaryBtn}>
              {requesting ? <ActivityIndicator color={throwColor.paper} /> : <Text style={styles.primaryLabel}>Allow Location</Text>}
            </View>
          </Pressable>
          <Pressable onPress={() => setShowManual(true)}>
            <Text style={styles.secondaryLabel}>Not Now — pick my city</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Where are you?</Text>
          <TextInput
            style={styles.search}
            placeholder="Search for your city"
            placeholderTextColor={throwColor.inkFaint}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <FlatList
            data={results}
            keyExtractor={(item) => `${item.city}-${item.country}`}
            renderItem={({ item }) => (
              <Pressable onPress={() => chooseCity(item)}>
                <View style={styles.cityRow}>
                  <Text style={styles.cityName}>{item.city}</Text>
                  <Text style={styles.cityCountry}>{item.country}</Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No cities match "{query}"</Text>}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: throwColor.screenBg, paddingHorizontal: throwSpace.gutter },
  backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  backLabel: { fontFamily: throwFont.ui600, fontSize: 13, color: throwColor.inkSoft },
  center: { flex: 1, justifyContent: 'center' },
  title: { fontFamily: throwFont.ui700, fontSize: 22, color: throwColor.ink, marginBottom: 10 },
  body: { fontFamily: throwFont.ui400, fontSize: 14.5, color: throwColor.inkSoft, lineHeight: 21, marginBottom: 28 },
  error: { fontFamily: throwFont.ui400, fontSize: 12.5, color: '#B3413A', marginBottom: 12 },
  primaryBtn: {
    minHeight: 54,
    borderRadius: throwRadius.pill,
    backgroundColor: throwColor.clayDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  primaryLabel: { fontFamily: throwFont.ui700, fontSize: 15, color: throwColor.paper },
  secondaryLabel: { fontFamily: throwFont.ui600, fontSize: 13.5, color: throwColor.inkSoft, textAlign: 'center' },
  search: {
    minHeight: 48,
    borderRadius: throwRadius.card,
    backgroundColor: throwColor.cardBg,
    borderWidth: 1,
    borderColor: throwColor.cardBorder,
    paddingHorizontal: 16,
    fontFamily: throwFont.ui400,
    fontSize: 15,
    color: throwColor.ink,
    marginBottom: 14,
  },
  cityRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: throwColor.cardBorder },
  cityName: { fontFamily: throwFont.ui600, fontSize: 15, color: throwColor.ink },
  cityCountry: { fontFamily: throwFont.ui400, fontSize: 13, color: throwColor.inkMute },
  empty: { fontFamily: throwFont.ui400, fontSize: 13.5, color: throwColor.inkMute, textAlign: 'center', marginTop: 24 },
});
