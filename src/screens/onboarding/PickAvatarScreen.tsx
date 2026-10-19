import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { OnboardingBackButton, MonoTag, StickerButton } from '../../components/onboarding/StickerKit';
import { useAuth } from '../../context/AuthContext';
import { initialsOf } from '../../utils/friendAvatar';
import { obColor, obFont } from '../../theme/onboardingTokens';
import type { SignUpAnswers } from './SignUpStepsScreen';

// Purely cosmetic choice for this onboarding flow's own "Your Pass" preview — it's never written
// to the account, since every other screen in the app colors avatars deterministically by user id
// (see src/utils/friendAvatar.ts), not by stored preference. Names + colors match the handoff's
// 8-swatch "Pick your sticker" reference.
const SWATCHES = [
  { name: 'SUNNY', bg: obColor.sunflower, fg: obColor.deepInk },
  { name: 'TOMATO', bg: obColor.tomato, fg: '#fff' },
  { name: 'COBALT', bg: obColor.cobalt, fg: '#fff' },
  { name: 'MIDNIGHT', bg: obColor.deepInk, fg: '#fff' },
  { name: 'PAPER', bg: '#FFFFFF', fg: obColor.deepInk },
  { name: 'PERIWINKLE', bg: '#A6B1F7', fg: obColor.deepInk },
  { name: 'BUBBLEGUM', bg: '#FF9FD6', fg: obColor.deepInk },
  { name: 'MINT', bg: '#7FD99A', fg: obColor.deepInk },
];

interface PickAvatarScreenProps {
  answers: SignUpAnswers;
  onBack: () => void;
  /** Fires once signUp() actually succeeds — hands the chosen local photo/color forward so the
   * post-confirmation step can upload them once a real session exists. */
  onDone: (choice: { photoUri: string | null; swatchIdx: number }) => void;
}

/** 04 Pick your look — photo + color swatch, then "Create my space" actually calls signUp(). */
export function PickAvatarScreen({ answers, onBack, onDone }: PickAvatarScreenProps) {
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [swatchIdx, setSwatchIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = initialsOf(answers.fullName);
  const skin = SWATCHES[swatchIdx];

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission was denied.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets?.[0]) return;
    setPhotoUri(result.assets[0].uri);
  };

  const submit = async () => {
    setError(null);
    setLoading(true);
    const { error: signUpError } = await signUp(answers.fullName, answers.email, answers.password);
    setLoading(false);
    if (signUpError) {
      setError(signUpError);
      return;
    }
    onDone({ photoUri, swatchIdx });
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 22 }]}>
      <View style={styles.header}>
        <OnboardingBackButton onPress={onBack} />
        <MonoTag text="STEP 2/2" bg={obColor.sunflower} />
      </View>

      <Text style={styles.title}>
        Pick your{'\n'}
        <Text style={{ color: obColor.tomato }}>sticker.</Text>
      </Text>
      <Text style={styles.subtitle}>Add a photo, pick a colour. It&apos;s how friends spot you on chats and the map.</Text>

      <View style={styles.avatarWrap}>
        <View style={styles.doodleLeft}>
          <Svg width={40} height={40} viewBox="0 0 40 40">
            <Path d="M4 6l7 7M3 16l9 2M8 26l6-5" stroke={obColor.tomato} strokeWidth={2.5} strokeLinecap="round" />
          </Svg>
        </View>
        <View style={styles.doodleTopRight}>
          <Svg width={34} height={34} viewBox="0 0 34 34">
            <Path
              d="M17 2l2.4 8.6L28 13l-8.6 2.4L17 24l-2.4-8.6L6 13l8.6-2.4L17 2z"
              fill={obColor.sunflower}
              stroke={obColor.ink}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          </Svg>
        </View>
        <View style={styles.doodleBottomLeft}>
          <Svg width={30} height={30} viewBox="0 0 30 30">
            <Path d="M3 10c4-6 9-6 10 0s6 6 10 0" stroke={obColor.ink} strokeWidth={2.5} strokeLinecap="round" fill="none" />
          </Svg>
        </View>
        <View style={[styles.avatarRing, { shadowColor: skin.bg }]}>
          <View style={[styles.avatarCircle, { backgroundColor: skin.bg, borderColor: skin.bg }]}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarPhoto} />
            ) : (
              <Text style={[styles.avatarInitials, { color: skin.fg }]}>{initials}</Text>
            )}
          </View>
          <View style={styles.nameTag}>
            <Text style={styles.nameTagText}>{skin.name}</Text>
          </View>
        </View>
      </View>

      <View style={styles.photoRow}>
        <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="Add a photo" style={styles.photoButton}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4 7h3l1.5-2h7L17 7h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z M12 16a4 4 0 100-8 4 4 0 000 8z"
              stroke={obColor.ink}
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.photoButtonText}>{photoUri ? 'Change photo' : 'Add your photo'}</Text>
        </Pressable>
        {photoUri && (
          <Pressable onPress={() => setPhotoUri(null)} accessibilityRole="button" accessibilityLabel="Remove photo" style={styles.removeButton}>
            <Text style={styles.photoButtonText}>Remove</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.swatchGrid}>
        {SWATCHES.map((s, i) => (
          <Pressable
            key={i}
            onPress={() => setSwatchIdx(i)}
            accessibilityRole="button"
            accessibilityLabel={`Colour option ${i + 1}`}
            style={[styles.swatch, { backgroundColor: s.bg }, swatchIdx === i && styles.swatchActive]}
          >
            {swatchIdx === i && <Text style={{ color: s.fg, fontWeight: '800' }}>✓</Text>}
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={{ flex: 1 }} />

      <StickerButton
        label={loading ? '' : 'Create my space'}
        onPress={submit}
        bg={obColor.ink}
        textColor={obColor.sunflower}
        shadowColor={obColor.tomato}
        loading={loading}
        icon="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: obColor.paper, paddingHorizontal: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginTop: 20, fontFamily: obFont.display800, fontSize: 40, lineHeight: 40, letterSpacing: -1.6, color: obColor.ink },
  subtitle: { marginTop: 6, fontFamily: obFont.ui500, fontSize: 14.5, lineHeight: 20, color: obColor.inkMute },
  avatarWrap: { alignItems: 'center', marginTop: 20, position: 'relative' },
  doodleLeft: { position: 'absolute', left: 6, top: 60, transform: [{ rotate: '-8deg' }] },
  doodleTopRight: { position: 'absolute', right: 14, top: 6, transform: [{ rotate: '14deg' }] },
  doodleBottomLeft: { position: 'absolute', left: 18, top: 210, transform: [{ rotate: '-4deg' }] },
  avatarRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#fff',
    padding: 10,
    borderWidth: 3,
    borderColor: obColor.ink,
    shadowOffset: { width: 7, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  avatarCircle: { flex: 1, borderRadius: 90, borderWidth: 7, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarPhoto: { width: '100%', height: '100%' },
  avatarInitials: { fontFamily: obFont.display800, fontSize: 64 },
  nameTag: {
    position: 'absolute',
    right: -18,
    bottom: 16,
    backgroundColor: obColor.ink,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    transform: [{ rotate: '8deg' }],
  },
  nameTagText: { fontFamily: obFont.mono700, fontSize: 11, color: '#fff', letterSpacing: 1 },
  photoRow: { marginTop: 26, flexDirection: 'row', justifyContent: 'center', gap: 10 },
  photoButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, backgroundColor: '#fff', borderWidth: 2, borderColor: obColor.ink, paddingVertical: 11, paddingHorizontal: 18, shadowColor: '#111', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
  removeButton: { borderRadius: 999, borderWidth: 2, borderColor: obColor.ink, paddingVertical: 11, paddingHorizontal: 16 },
  photoButtonText: { fontFamily: obFont.ui700, fontSize: 14.5, color: obColor.ink },
  swatchGrid: { marginTop: 22, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  swatch: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: obColor.ink, alignItems: 'center', justifyContent: 'center' },
  swatchActive: { transform: [{ scale: 1.12 }], shadowColor: '#111', shadowOffset: { width: 2, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
  error: { marginTop: 14, fontFamily: obFont.ui600, fontSize: 13, color: obColor.tomato, textAlign: 'center' },
});
