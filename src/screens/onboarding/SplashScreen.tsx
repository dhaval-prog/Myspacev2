import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { StickerButton } from '../../components/onboarding/StickerKit';
import { navItems } from '../../data/navItems';
import { obFont } from '../../theme/onboardingTokens';
import { useReducedMotion } from '../../hooks/useReducedMotion';

// None of these may be '#2B4BFF' (cobalt) — that's this screen's own background color, and a
// letter painted in it would vanish into the backdrop, showing only its stroke outline (exactly
// what happened here before this fix).
const LETTERS: { ch: string; color: string; rot: number }[] = [
  { ch: 'm', color: '#FFD23F', rot: -6 },
  { ch: 'y', color: '#FF4F2E', rot: 4 },
  { ch: 's', color: '#FFFFFF', rot: -5 },
  { ch: 'p', color: '#C3EA4F', rot: 6 },
  { ch: 'a', color: '#FFD23F', rot: -4 },
  { ch: 'c', color: '#FF4F2E', rot: 5 },
  { ch: 'e', color: '#C3EA4F', rot: -6 },
];

// Four of the app's own nav glyphs, as tappable sticker circles — same icons a new user will
// actually land on after onboarding, not invented decoration.
const STICKERS = [
  { id: 'chat', bg: '#FF4F2E', left: 36, top: 90 },
  { id: 'map', bg: '#C3EA4F', left: 300, top: 120 },
  { id: 'games', bg: '#FFD23F', left: 300, top: 420 },
  { id: 'expenses', bg: '#2B4BFF', left: 30, top: 460 },
];

interface SplashScreenProps {
  onContinue: () => void;
}

/** 01 Splash — cobalt backdrop, logo stamps in, "myspace" wordmark pops letter by letter, then
 * the CTA rises in. A few of the app's own nav glyphs float as tappable stickers around the logo
 * purely for charm (tapping just gives a small bounce — they don't navigate anywhere). */
export function SplashScreen({ onContinue }: SplashScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const logoScale = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const letterAnims = useRef(LETTERS.map(() => new Animated.Value(reduceMotion ? 1 : 0))).current;
  const taglineOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const ctaY = useRef(new Animated.Value(reduceMotion ? 0 : 40)).current;
  const ctaOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const stickerScales = useRef(STICKERS.map(() => new Animated.Value(reduceMotion ? 1 : 0))).current;

  useEffect(() => {
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 40000, useNativeDriver: true })).start();
    if (reduceMotion) return;
    Animated.sequence([
      Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.stagger(
        60,
        letterAnims.map((v) => Animated.spring(v, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true })),
      ),
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.stagger(
          70,
          stickerScales.map((v) => Animated.spring(v, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true })),
        ),
      ]),
      Animated.parallel([
        Animated.timing(ctaOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(ctaY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bounceSticker = (i: number) => {
    Animated.sequence([
      Animated.spring(stickerScales[i], { toValue: 1.15, friction: 4, tension: 200, useNativeDriver: true }),
      Animated.spring(stickerScales[i], { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
    ]).start();
  };

  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.ring, styles.ringOuter, { transform: [{ rotate: spinDeg }] }]} />
      <Animated.View
        style={[styles.ring, styles.ringInner, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }] }]}
      />

      {STICKERS.map((st, i) => {
        const item = navItems.find((n) => n.id === st.id);
        if (!item) return null;
        return (
          <Animated.View
            key={st.id}
            style={[styles.stickerWrap, { left: st.left, top: st.top, transform: [{ scale: stickerScales[i] }] }]}
          >
            <Animated.View onTouchEnd={() => bounceSticker(i)} style={[styles.sticker, { backgroundColor: st.bg }]}>
              <Icon path={item.icon} size={26} color="#111" strokeWidth={2.2} />
            </Animated.View>
          </Animated.View>
        );
      })}

      <View style={styles.center}>
        <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoScale }, { rotate: '-6deg' }] }]}>
          <Image source={require('../../../assets/icon.png')} style={styles.logo} resizeMode="cover" />
        </Animated.View>

        <View style={styles.wordmarkRow}>
          {LETTERS.map((l, i) => (
            <Animated.Text
              key={`${l.ch}-${i}`}
              style={[
                styles.wordmarkLetter,
                {
                  color: l.color,
                  transform: [
                    { rotate: `${l.rot}deg` },
                    { scale: letterAnims[i] },
                    { translateY: letterAnims[i].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
                  ],
                  opacity: letterAnims[i],
                },
              ]}
            >
              {l.ch}
            </Animated.Text>
          ))}
        </View>
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>your space. your people.</Animated.Text>
      </View>

      <Animated.View style={{ paddingHorizontal: 40, paddingBottom: insets.bottom + 44, opacity: ctaOpacity, transform: [{ translateY: ctaY }] }}>
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
  center: { alignItems: 'center', marginTop: -60 },
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
  wordmarkLetter: {
    fontFamily: obFont.display800,
    fontSize: 54,
    lineHeight: 58,
    letterSpacing: -1.5,
    textShadowColor: '#111',
    textShadowOffset: { width: 2.5, height: 2.5 },
    textShadowRadius: 0,
  },
  tagline: { marginTop: 10, fontFamily: obFont.hand700, fontSize: 24, color: '#fff' },
});
