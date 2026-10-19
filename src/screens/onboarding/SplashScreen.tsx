import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { StickerButton } from '../../components/onboarding/StickerKit';
import { obFont } from '../../theme/onboardingTokens';
import { useReducedMotion } from '../../hooks/useReducedMotion';

// Two-tone wordmark — "my" and "space" each their own flat color, not a rainbow per-letter
// rotation. Neither may be '#2B4BFF' (cobalt), this screen's own background color — a word
// painted in it would vanish into the backdrop, showing only its stroke outline.
const WORDMARK: { word: string; color: string }[] = [
  { word: 'my', color: '#FFD23F' },
  { word: 'space', color: '#FFFFFF' },
];

// Real icon content (not blank circles) — a mix of the app's own glyphs (plane/chat/pin) and a
// few purely decorative ones (people/heart/speaker/music), matching the handoff's sticker set.
const PLANE_ICON = 'M22 2L11 13 M22 2L15 22L11 13L2 9L22 2Z';
const CHAT_ICON = 'M20 11.5a7.5 7.5 0 0 1-10.7 6.8L4 19.5l1.3-4.9A7.5 7.5 0 1 1 20 11.5z';
const PEOPLE_ICON = 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75';
const PIN_ICON = 'M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z';
const HEART_ICON = 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z';
const SPEAKER_ICON = 'M11 5 6 9H2v6h4l5 4V5z M15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14';
const MUSIC_ICON = 'M9 18V5l12-2v13 M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z';

// The 4 larger stickers orbiting the logo.
const CORNER_STICKERS = [
  { id: 'plane', icon: PLANE_ICON, bg: '#FFD23F', left: 36, top: 90 },
  { id: 'chat', icon: CHAT_ICON, bg: '#FFFFFF', left: 300, top: 120 },
  { id: 'people', icon: PEOPLE_ICON, bg: '#C3EA4F', left: 30, top: 460 },
  { id: 'pin', icon: PIN_ICON, bg: '#FF4F2E', left: 300, top: 430 },
];

// The row of 3 smaller stickers under the tagline.
const ROW_STICKERS = [
  { id: 'heart', icon: HEART_ICON, bg: '#FFB4C8' },
  { id: 'speaker', icon: SPEAKER_ICON, bg: '#B9C8FF' },
  { id: 'music', icon: MUSIC_ICON, bg: '#FFFFFF' },
];

interface SplashScreenProps {
  onContinue: () => void;
}

/** 01 Splash — cobalt backdrop, logo stamps in, "myspace" wordmark pops in two-tone, then a ring
 * of sticker glyphs and the CTA rise in. Tapping a sticker just gives a small bounce — they don't
 * navigate anywhere, purely charm. */
export function SplashScreen({ onContinue }: SplashScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const logoScale = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const wordAnims = useRef(WORDMARK.map(() => new Animated.Value(reduceMotion ? 1 : 0))).current;
  const taglineOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const ctaY = useRef(new Animated.Value(reduceMotion ? 0 : 40)).current;
  const ctaOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const cornerScales = useRef(CORNER_STICKERS.map(() => new Animated.Value(reduceMotion ? 1 : 0))).current;
  const rowScales = useRef(ROW_STICKERS.map(() => new Animated.Value(reduceMotion ? 1 : 0))).current;

  useEffect(() => {
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 40000, useNativeDriver: true })).start();
    if (reduceMotion) return;
    Animated.sequence([
      Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.stagger(
        100,
        wordAnims.map((v) => Animated.spring(v, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true })),
      ),
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.stagger(
          70,
          [...cornerScales, ...rowScales].map((v) => Animated.spring(v, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true })),
        ),
      ]),
      Animated.parallel([
        Animated.timing(ctaOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(ctaY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bounce = (v: Animated.Value) => {
    Animated.sequence([
      Animated.spring(v, { toValue: 1.15, friction: 4, tension: 200, useNativeDriver: true }),
      Animated.spring(v, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
    ]).start();
  };

  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.ring, styles.ringOuter, { transform: [{ rotate: spinDeg }] }]} />
      <Animated.View
        style={[styles.ring, styles.ringInner, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }] }]}
      />

      {CORNER_STICKERS.map((st, i) => (
        <Animated.View key={st.id} style={[styles.stickerWrap, { left: st.left, top: st.top, transform: [{ scale: cornerScales[i] }] }]}>
          <Animated.View onTouchEnd={() => bounce(cornerScales[i])} style={[styles.sticker, { backgroundColor: st.bg }]}>
            <Icon path={st.icon} size={26} color="#111" strokeWidth={2.2} />
          </Animated.View>
        </Animated.View>
      ))}

      <View style={styles.center}>
        <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoScale }, { rotate: '-6deg' }] }]}>
          <Image source={require('../../../assets/icon.png')} style={styles.logo} resizeMode="cover" />
        </Animated.View>

        <View style={styles.wordmarkRow}>
          {WORDMARK.map((w, i) => (
            <Animated.Text
              key={w.word}
              style={[
                styles.wordmarkWord,
                {
                  color: w.color,
                  transform: [{ scale: wordAnims[i] }, { translateY: wordAnims[i].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
                  opacity: wordAnims[i],
                },
              ]}
            >
              {w.word}
            </Animated.Text>
          ))}
        </View>
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>your space. your people.</Animated.Text>

        <View style={styles.rowStickers}>
          {ROW_STICKERS.map((st, i) => (
            <Animated.View key={st.id} style={{ transform: [{ scale: rowScales[i] }] }}>
              <Animated.View onTouchEnd={() => bounce(rowScales[i])} style={[styles.rowSticker, { backgroundColor: st.bg }]}>
                <Icon path={st.icon} size={20} color="#111" strokeWidth={2.2} />
              </Animated.View>
            </Animated.View>
          ))}
        </View>
        <Animated.View style={[styles.hint, { opacity: taglineOpacity }]}>
          <Text style={styles.hintText}>tap a sticker ✦</Text>
        </Animated.View>
      </View>

      <Animated.View style={{ paddingHorizontal: 40, paddingBottom: insets.bottom + 24, opacity: ctaOpacity, transform: [{ translateY: ctaY }] }}>
        <StickerButton label="Step inside" onPress={onContinue} bg="#FFD23F" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#2B4BFF', justifyContent: 'flex-end', overflow: 'hidden' },
  ring: { position: 'absolute', left: '50%', top: 330, borderRadius: 999, borderWidth: 2, borderColor: 'rgba(255,255,255,.2)', borderStyle: 'dashed' },
  ringOuter: { width: 420, height: 420, marginLeft: -210, marginTop: -210 },
  ringInner: { width: 300, height: 300, marginLeft: -150, marginTop: -150 },
  stickerWrap: { position: 'absolute' },
  sticker: {
    width: 64,
    height: 64,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111',
    shadowOffset: { width: 4, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  center: { alignItems: 'center', marginTop: -40 },
  logoWrap: {
    width: 148,
    height: 148,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#111',
    overflow: 'hidden',
    shadowColor: '#111',
    shadowOffset: { width: 9, height: 11 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 10,
  },
  logo: { width: '100%', height: '100%' },
  wordmarkRow: { flexDirection: 'row', marginTop: 24 },
  wordmarkWord: {
    fontFamily: obFont.display800,
    fontSize: 54,
    lineHeight: 58,
    letterSpacing: -1.5,
    textShadowColor: '#111',
    textShadowOffset: { width: 2.5, height: 2.5 },
    textShadowRadius: 0,
  },
  tagline: { marginTop: 10, fontFamily: obFont.hand700, fontSize: 24, color: '#fff' },
  rowStickers: { flexDirection: 'row', gap: 14, marginTop: 22 },
  rowSticker: {
    width: 56,
    height: 56,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111',
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  hint: { marginTop: 12, backgroundColor: '#fff', borderWidth: 2, borderColor: '#111', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  hintText: { fontFamily: obFont.ui700, fontSize: 13, color: '#111' },
});
