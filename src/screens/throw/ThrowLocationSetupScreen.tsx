import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThrowGlassBackdrop } from '../../components/throw/ThrowGlassBackdrop';
import { GlassSurface } from '../../components/friends/GlassSurface';
import { colors } from '../../theme/colors';
import { throwColor, throwFont, throwGlass, throwRadius, throwSpace } from '../../theme/throwTokens';
import { nearestThrowCity, searchThrowCities, type ThrowCity } from '../../utils/throwCities';
import { useThrow } from '../../context/ThrowContext';

interface ThrowLocationSetupScreenProps {
  onDone: () => void;
  onBack?: () => void;
  /** 'setup' (default) is the first-time flow; 'edit' is reached later from Throw's settings
   * icon to change an already-set location — same two options (GPS or manual search), just
   * worded as a change rather than an introduction. */
  mode?: 'setup' | 'edit';
}

export function ThrowLocationSetupScreen({ onDone, onBack, mode = 'setup' }: ThrowLocationSetupScreenProps) {
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
      // Highest available accuracy — this is meant to place a pin at the user's real position,
      // not the default `Balanced` (~100m) tier getCurrentPositionAsync({}) used to fall back to.
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const exact = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      // The city name is always best-effort (reverse geocoding, or else the nearest entry in our
      // own curated list) — but the *coordinates* stored below are always the real GPS fix, on
      // every path. `nearestThrowCity` used to also supply its own preset city's coordinates
      // whenever reverse geocoding wasn't available (e.g. on web), which silently snapped the
      // pin onto a fixed list entry instead of the user's actual position — city is only ever
      // used here for the label now, never for `latitude`/`longitude`.
      let cityLabel: { city: string; country: string } | null = null;
      try {
        const geocoded = await Location.reverseGeocodeAsync(exact);
        const first = geocoded[0];
        if (first?.city && first?.country) cityLabel = { city: first.city, country: first.country };
      } catch {
        // Reverse geocoding isn't available on this platform (e.g. web) — fall back below.
      }
      if (!cityLabel) cityLabel = nearestThrowCity(exact.latitude, exact.longitude);
      await chooseCity({ ...cityLabel, ...exact });
    } catch {
      setShowManual(true);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <ThrowGlassBackdrop heightMultiplier={1.2} />
      {onBack && (
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backLabel}>Cancel</Text>
        </Pressable>
      )}

      {!showManual ? (
        <View style={styles.center}>
          <Text style={styles.title}>{mode === 'edit' ? 'Update your location' : 'Let Throw know where you are'}</Text>
          <Text style={styles.body}>
            {mode === 'edit'
              ? "Change where your letters travel from — use your phone's current location, or pick a different city."
              : 'Your location helps your letters travel from where you are to where your friends are.'}
          </Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable onPress={requestDeviceLocation} disabled={requesting}>
            <View style={styles.primaryBtn}>
              {requesting ? <ActivityIndicator color={throwColor.ink} /> : <Text style={styles.primaryLabel}>Allow Location</Text>}
            </View>
          </Pressable>
          <Pressable onPress={() => setShowManual(true)}>
            <Text style={styles.secondaryLabel}>{mode === 'edit' ? 'Pick a different city instead' : 'Not Now — pick my city'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Where are you?</Text>
          <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.searchWrap}>
            <TextInput
              style={styles.search}
              placeholder="Search for your city"
              placeholderTextColor={throwColor.inkFaint}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
          </GlassSurface>
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
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  primaryLabel: { fontFamily: throwFont.ui700, fontSize: 15, color: throwColor.ink },
  secondaryLabel: { fontFamily: throwFont.ui600, fontSize: 13.5, color: throwColor.inkSoft, textAlign: 'center' },
  searchWrap: {
    minHeight: 48,
    borderRadius: throwRadius.card,
    borderWidth: 1,
    borderColor: throwGlass.border,
    marginBottom: 14,
  },
  search: {
    minHeight: 48,
    paddingHorizontal: 16,
    fontFamily: throwFont.ui400,
    fontSize: 15,
    color: throwColor.ink,
  },
  cityRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: throwColor.cardBorder },
  cityName: { fontFamily: throwFont.ui600, fontSize: 15, color: throwColor.ink },
  cityCountry: { fontFamily: throwFont.ui400, fontSize: 13, color: throwColor.inkMute },
  empty: { fontFamily: throwFont.ui400, fontSize: 13.5, color: throwColor.inkMute, textAlign: 'center', marginTop: 24 },
});
