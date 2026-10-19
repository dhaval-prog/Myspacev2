import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StickerButton } from '../../components/onboarding/StickerKit';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { initialsOf } from '../../utils/friendAvatar';
import { colors } from '../../theme';
import { obColor, obFont } from '../../theme/onboardingTokens';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const SWATCHES = [
  { bg: colors.lime, fg: colors.ink },
  { bg: colors.pale, fg: colors.ink },
  { bg: colors.coral, fg: '#fff' },
];

// Deterministic bar widths for the barcode strip — a real striped pattern rather than a flat bar.
const BARCODE_BARS = [3, 1, 2, 1, 4, 1, 1, 2, 3, 1, 2, 4, 1, 1, 3, 2, 1, 4, 1, 2, 1, 3];

const CONFETTI = Array.from({ length: 14 }, (_, i) => ({
  x: 10 + ((i * 37) % 340),
  delay: (i % 7) * 180,
  duration: 2600 + (i % 5) * 300,
  bg: [obColor.sunflower, obColor.tomato, obColor.lime, '#fff'][i % 4],
  size: 8 + (i % 3) * 4,
}));

interface YourPassScreenProps {
  fullName: string;
  email: string;
  photoUri: string | null;
  swatchIdx: number;
  onContinue: () => void;
}

/** 07 Your pass — celebratory "space is live" screen. Uploads the photo chosen back on Pick Your
 * Look now (this is the first point with a real, confirmed session, so it's the first point that
 * can actually write to Storage/`profiles` without an RLS rejection). */
export function YourPassScreen({ fullName, email, photoUri, swatchIdx, onContinue }: YourPassScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const confettiAnims = useRef(CONFETTI.map(() => new Animated.Value(0))).current;
  const dropAnim = useRef(new Animated.Value(reduceMotion ? 0 : -1)).current;

  useEffect(() => {
    Animated.timing(dropAnim, { toValue: 0, duration: reduceMotion ? 0 : 550, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }).start();
    if (reduceMotion) return;
    confettiAnims.forEach((v, i) => {
      Animated.loop(Animated.timing(v, { toValue: 1, duration: CONFETTI[i].duration, delay: CONFETTI[i].delay, easing: Easing.linear, useNativeDriver: true })).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!photoUri || !user?.id) return;
    (async () => {
      try {
        const response = await fetch(photoUri);
        const blob = await response.blob();
        const ext = (photoUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
        const path = `${user.id}/avatar.${ext}`;
        const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
        if (upErr) return;
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
        const publicUrl = `${pub.publicUrl}?t=${Date.now()}`;
        await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
        setUploadedPhotoUrl(publicUrl);
      } catch {
        // Best-effort — the user can always set a photo later from Account Settings; the
        // celebratory pass screen shouldn't block on a failed upload.
      }
    })();
  }, [photoUri, user?.id]);

  const initials = initialsOf(fullName);
  const skin = SWATCHES[swatchIdx] ?? SWATCHES[0];
  const handle = (user?.user_metadata?.full_name ?? fullName).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'friend';
  const photoSrc = uploadedPhotoUrl ?? photoUri;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 22 }]}>
      {CONFETTI.map((c, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.confetti,
            {
              left: c.x,
              width: c.size,
              height: c.size,
              backgroundColor: c.bg,
              transform: [
                { translateY: confettiAnims[i].interpolate({ inputRange: [0, 1], outputRange: [-40, 860] }) },
                { rotate: confettiAnims[i].interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] }) },
              ],
            },
          ]}
        />
      ))}

      <Animated.View style={[styles.lanyardAndCard, { transform: [{ translateY: dropAnim.interpolate({ inputRange: [-1, 0], outputRange: [-560, 0] }) }] }]}>
        <View style={styles.lanyardRibbon}>
          <Text style={styles.lanyardText}>MYSPACE ✦ MYSPACE ✦ MYSPACE</Text>
        </View>
        <View style={styles.lanyardClip} />
        <View style={styles.card}>
          <View style={styles.cardInner}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderText}>myspace pass</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={[styles.cardAvatar, { backgroundColor: skin.bg, borderColor: skin.bg }]}>
                {photoSrc ? <Image source={{ uri: photoSrc }} style={styles.cardAvatarPhoto} /> : <Text style={[styles.cardAvatarInitials, { color: skin.fg }]}>{initials}</Text>}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cardName} numberOfLines={1}>{fullName}</Text>
                <Text style={styles.cardHandle}>@{handle}</Text>
                <Text style={styles.cardMeta}>MEMBER SINCE {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.cardStats}>
              <Text style={styles.cardStat}>FRIENDS 0</Text>
              <Text style={styles.cardStat}>LETTERS 0</Text>
              <Text style={styles.cardStat}>GAMES 0</Text>
            </View>
            <View style={styles.barcode}>
              {BARCODE_BARS.map((w, i) => (
                <View key={i} style={[styles.barcodeBar, { width: w }]} />
              ))}
            </View>
          </View>
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW!</Text>
          </View>
        </View>
      </Animated.View>

      <Text style={styles.title}>Your space{'\n'}is live!</Text>

      <View style={{ flex: 1 }} />

      <StickerButton label="Add my first friend" onPress={onContinue} bg={obColor.sunflower} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: obColor.cobalt, paddingHorizontal: 22, alignItems: 'center', overflow: 'hidden' },
  confetti: { position: 'absolute', top: 0, borderRadius: 3, borderWidth: 2, borderColor: obColor.ink },
  lanyardAndCard: { width: '100%', maxWidth: 290, alignItems: 'center' },
  lanyardRibbon: {
    width: 34,
    height: 170,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: obColor.ink,
    backgroundColor: obColor.tomato,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    overflow: 'hidden',
  },
  lanyardText: {
    fontFamily: obFont.mono700,
    fontSize: 10,
    letterSpacing: 2,
    color: '#fff',
    transform: [{ rotate: '90deg' }],
    width: 160,
    textAlign: 'center',
  },
  lanyardClip: {
    width: 44,
    height: 28,
    marginTop: -2,
    borderWidth: 2,
    borderColor: obColor.ink,
    borderRadius: 8,
    backgroundColor: '#dde0e6',
  },
  // No overflow: 'hidden' here — the NEW! badge below is a sibling of cardInner (which does the
  // actual content clipping) specifically so it can spill outside the card's rounded corner
  // instead of being cut off by it.
  card: {
    marginTop: -2,
    width: '100%',
    backgroundColor: '#FBF8F1',
    borderWidth: 3,
    borderColor: obColor.ink,
    borderRadius: 24,
  },
  cardInner: { borderRadius: 21, overflow: 'hidden' },
  cardHeader: { height: 50, backgroundColor: obColor.sunflower, borderBottomWidth: 3, borderColor: obColor.ink, justifyContent: 'center', paddingHorizontal: 16 },
  cardHeaderText: { fontFamily: obFont.display800, fontSize: 19, letterSpacing: -0.4, color: obColor.ink },
  cardBody: { flexDirection: 'row', gap: 14, alignItems: 'center', padding: 16 },
  cardAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cardAvatarPhoto: { width: '100%', height: '100%' },
  cardAvatarInitials: { fontFamily: obFont.display800, fontSize: 26 },
  cardName: { fontFamily: obFont.display800, fontSize: 20, letterSpacing: -0.6, color: obColor.ink },
  cardHandle: { marginTop: 3, fontFamily: obFont.mono400, fontSize: 12, color: obColor.ink },
  cardMeta: { marginTop: 3, fontFamily: obFont.mono400, fontSize: 9.5, color: obColor.inkMute },
  cardStats: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 2, borderStyle: 'dashed', borderColor: obColor.ink, paddingVertical: 9, paddingHorizontal: 16 },
  cardStat: { fontFamily: obFont.mono700, fontSize: 10.5, color: obColor.ink },
  barcode: { marginHorizontal: 16, marginBottom: 14, height: 26, flexDirection: 'row', alignItems: 'stretch', gap: 2, opacity: 0.85 },
  barcodeBar: { backgroundColor: obColor.ink },
  newBadge: { position: 'absolute', right: -14, top: 46, width: 58, height: 58, borderRadius: 29, backgroundColor: obColor.tomato, borderWidth: 2, borderColor: obColor.ink, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '12deg' }] },
  newBadgeText: { fontFamily: obFont.display800, fontSize: 15, color: '#fff' },
  title: { marginTop: 28, fontFamily: obFont.display800, fontSize: 36, lineHeight: 36, letterSpacing: -1.5, color: '#fff', textAlign: 'center' },
});
