import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { obColor, obFont } from '../../theme/onboardingTokens';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const TICKER_TEXT = 'CHAT ✦ THROW LETTERS ✦ PLAY NPAT ✦ TRIVIA NIGHTS ✦ POCKET BUDGETS ✦ FIND FRIENDS ON THE MAP ✦ ';
const TRACK_HEIGHT = 66;
const KNOB_SIZE = 52;
const KNOB_PAD = 5;

interface WelcomeScreenProps {
  onContinue: () => void;
  onLogin: () => void;
}

function ChatReel() {
  const bubble1 = useRef(new Animated.Value(0)).current;
  const bubble2 = useRef(new Animated.Value(0)).current;
  const bubble3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const seq = Animated.loop(
      Animated.sequence([
        Animated.timing(bubble1, { toValue: 1, duration: 1, useNativeDriver: true, delay: 300 }),
        Animated.timing(bubble2, { toValue: 1, duration: 1, useNativeDriver: true, delay: 900 }),
        Animated.timing(bubble3, { toValue: 1, duration: 1, useNativeDriver: true, delay: 900 }),
        Animated.delay(1800),
        Animated.parallel([
          Animated.timing(bubble1, { toValue: 0, duration: 1, useNativeDriver: true }),
          Animated.timing(bubble2, { toValue: 0, duration: 1, useNativeDriver: true }),
          Animated.timing(bubble3, { toValue: 0, duration: 1, useNativeDriver: true }),
        ]),
      ]),
    );
    seq.start();
    return () => seq.stop();
  }, [bubble1, bubble2, bubble3]);

  const pop = (v: Animated.Value) => ({ opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] });

  return (
    <View style={reelStyles.fill}>
      <View style={[reelStyles.row, { alignSelf: 'flex-start' }]}>
        <Animated.View style={[reelStyles.row, pop(bubble1)]}>
          <View style={[reelStyles.avatar, { backgroundColor: obColor.sunflower }]}>
            <Text style={reelStyles.avatarInitials}>PS</Text>
          </View>
          <View style={reelStyles.bubbleLeft}>
            <Text style={reelStyles.bubbleText}>dinner at 8?</Text>
          </View>
        </Animated.View>
      </View>
      <View style={[reelStyles.row, { alignSelf: 'flex-end', marginTop: 9 }]}>
        <Animated.View style={[reelStyles.row, pop(bubble2)]}>
          <View style={[reelStyles.bubbleRight]}>
            <Text style={[reelStyles.bubbleText, { color: '#fff' }]}>i&apos;m in!</Text>
          </View>
          <View style={[reelStyles.avatar, { backgroundColor: '#FFB4C8' }]}>
            <Text style={reelStyles.avatarInitials}>AK</Text>
          </View>
        </Animated.View>
      </View>
      <View style={[reelStyles.row, { alignSelf: 'flex-start', marginTop: 9 }]}>
        <Animated.View style={[reelStyles.row, pop(bubble3)]}>
          <View style={[reelStyles.avatar, { backgroundColor: '#7FE0A6' }]}>
            <Text style={reelStyles.avatarInitials}>RJ</Text>
          </View>
          <View style={reelStyles.bubbleLeft}>
            <Text style={reelStyles.bubbleText}>save me a seat</Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

/** 02 Welcome — the dark camcorder "FRIENDS.MOV" reel, a scrolling feature ticker, headline, and a
 * slide-to-start gesture track (dragging the knob to the end continues; tapping "Log in" switches
 * to the existing-account flow instead). */
export function WelcomeScreen({ onContinue, onLogin }: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const [trackWidth, setTrackWidth] = useState(0);
  const knobX = useRef(new Animated.Value(KNOB_PAD)).current;
  const knobXRef = useRef(KNOB_PAD);
  const marquee = useRef(new Animated.Value(0)).current;
  const fillWidth = Animated.add(knobX, KNOB_SIZE / 2);
  const [committed, setCommitted] = useState(false);

  useEffect(() => {
    const id = knobX.addListener(({ value }) => {
      knobXRef.current = value;
    });
    return () => knobX.removeListener(id);
  }, [knobX]);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.timing(marquee, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [marquee, reduceMotion]);

  const maxX = Math.max(KNOB_PAD, trackWidth - KNOB_SIZE - KNOB_PAD);
  const maxXRef = useRef(maxX);
  maxXRef.current = maxX;

  const commitOrReset = () => {
    if (knobXRef.current >= maxXRef.current - 2) {
      setCommitted(true);
      Animated.timing(knobX, { toValue: maxXRef.current, duration: 120, useNativeDriver: false }).start(() => onContinue());
    } else {
      Animated.spring(knobX, { toValue: KNOB_PAD, friction: 6, useNativeDriver: false }).start();
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4,
      onPanResponderMove: (_e, g) => {
        const next = Math.max(KNOB_PAD, Math.min(maxXRef.current, KNOB_PAD + g.dx));
        knobX.setValue(next);
      },
      onPanResponderRelease: commitOrReset,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ).current;
  const knobRef = useRef<View>(null);

  // react-native-web's PanResponder polyfill is the documented-flaky one in this codebase (see
  // ThrowReceivedLettersScreen's own letter-swipe gesture, and FoldingLetter's fold/flick gesture,
  // for the full writeup) — this drag is exactly the kind of case it fails on: real mobile Safari
  // touch-drag on the deployed web build, confirmed stuck mid-track rather than completing or
  // springing back. Reimplements the same drag purely from real pointer positions on web; native
  // keeps using PanResponder as-is above, since its real touch system doesn't have the bug.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = knobRef.current as any as HTMLElement | null;
    if (!node) return;
    const getX = (e: MouseEvent | TouchEvent): number | null => {
      if ('touches' in e) {
        const t = e.touches[0] ?? e.changedTouches[0];
        return t ? t.clientX : null;
      }
      return e.clientX;
    };
    let startX: number | null = null;
    let startKnobX = KNOB_PAD;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const x = getX(e);
      if (x === null) return;
      startX = x;
      startKnobX = knobXRef.current;
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (startX === null) return;
      const x = getX(e);
      if (x === null) return;
      const next = Math.max(KNOB_PAD, Math.min(maxXRef.current, startKnobX + (x - startX)));
      knobX.setValue(next);
    };
    const onUp = () => {
      if (startX === null) return;
      startX = null;
      commitOrReset();
    };
    node.addEventListener('mousedown', onDown);
    node.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      node.removeEventListener('mousedown', onDown);
      node.removeEventListener('touchstart', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const knobHandlers = Platform.OS === 'web' ? {} : panResponder.panHandlers;

  const marqueeX = marquee.interpolate({ inputRange: [0, 1], outputRange: [0, -(TICKER_TEXT.length * 7.6)] });

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 26 }]}>
      <View style={styles.headerRow}>
        <View style={styles.wordmarkTag}>
          <Text style={styles.wordmarkTagText}>myspace</Text>
        </View>
        <Pressable onPress={onLogin} accessibilityRole="button" accessibilityLabel="Log in" style={styles.loginPill}>
          <Text style={styles.loginPillText}>Log in</Text>
        </Pressable>
      </View>

      <View style={styles.phoneFrame}>
        <View style={styles.phoneDot} />
        <View style={styles.reelBox}>
          <ChatReel />
          <View pointerEvents="none" style={styles.reelVignette} />
          <View style={styles.recBadge}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>REC</Text>
          </View>
        </View>
        <View style={styles.phoneFooter}>
          <View style={styles.row}>
            <View style={styles.recDotSmall} />
            <Text style={styles.filmLabel}>FRIENDS.MOV</Text>
          </View>
          <Text style={styles.filmCounter}>01 / 03</Text>
        </View>
      </View>

      <View style={styles.marqueeWrap}>
        <Animated.View style={[styles.marqueeRow, { transform: [{ translateX: marqueeX }] }]}>
          <Text style={styles.marqueeText}>{TICKER_TEXT.repeat(3)}</Text>
        </Animated.View>
      </View>

      <Text style={styles.headline}>
        A little space{'\n'}for{' '}
        <Text style={styles.headlineHighlight}> your people. </Text>
      </Text>

      <View style={{ flex: 1 }} />

      <View
        style={[styles.track, { width: Math.min(width - 44, 346) }]}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View style={[styles.trackFill, { width: fillWidth }]} />
        <Text style={styles.trackLabel}>Slide to make your space →</Text>
        <Animated.View ref={knobRef} style={[styles.knob, { transform: [{ translateX: knobX }] }]} {...(committed ? {} : knobHandlers)}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M5 12h14M13 6l6 6-6 6" stroke="#111" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: obColor.paper, paddingHorizontal: 22 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center' },
  wordmarkTag: {
    backgroundColor: obColor.sunflower,
    borderWidth: 2,
    borderColor: obColor.ink,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
    transform: [{ rotate: '-4deg' }],
  },
  wordmarkTagText: { fontFamily: obFont.display800, fontSize: 18, color: obColor.ink },
  loginPill: {
    borderWidth: 2,
    borderColor: obColor.ink,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    shadowColor: '#111',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  loginPillText: { fontFamily: obFont.ui700, fontSize: 13.5, color: obColor.ink },
  phoneFrame: {
    marginTop: 22,
    alignSelf: 'center',
    width: 322,
    maxWidth: '100%',
    backgroundColor: '#202226',
    borderWidth: 3,
    borderColor: obColor.ink,
    borderRadius: 26,
    padding: 11,
    shadowColor: '#111',
    shadowOffset: { width: 7, height: 7 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  phoneDot: {
    position: 'absolute',
    right: -14,
    top: -16,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: obColor.ink,
    backgroundColor: obColor.cobalt,
    zIndex: 3,
  },
  reelBox: { height: 230, borderRadius: 15, overflow: 'hidden', backgroundColor: '#2a2b30', borderWidth: 2, borderColor: obColor.ink, padding: 16 },
  reelVignette: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' },
  recBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(17,17,17,.75)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  recDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: obColor.tomato },
  recText: { fontFamily: obFont.mono700, fontSize: 10, color: '#fff' },
  phoneFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 9, paddingHorizontal: 4 },
  recDotSmall: { width: 9, height: 9, borderRadius: 5, backgroundColor: obColor.tomato, marginRight: 8 },
  filmLabel: { fontFamily: obFont.mono700, fontSize: 11, color: '#E9E4D6' },
  filmCounter: { fontFamily: obFont.mono400, fontSize: 11, color: 'rgba(233,228,214,.6)' },
  marqueeWrap: { marginTop: 22, marginHorizontal: -22, borderTopWidth: 2, borderBottomWidth: 2, borderColor: obColor.ink, backgroundColor: obColor.ink, overflow: 'hidden', paddingVertical: 9 },
  // flexDirection: 'row' lets this row grow past the screen's own width instead of being
  // measured against it — a plain Text here (even with numberOfLines={1}) gets its layout box
  // clamped to the parent's width on native and silently truncates everything past that, which
  // on web's nowrap-by-default text layout never happens — exactly why this rendered fine in an
  // earlier browser check but came back blank on a real phone.
  marqueeRow: { flexDirection: 'row' },
  marqueeText: { flexShrink: 0, fontFamily: obFont.mono700, fontSize: 13, color: obColor.sunflower },
  headline: { marginTop: 20, fontFamily: obFont.display800, fontSize: 38, lineHeight: 40, letterSpacing: -1.4, color: obColor.ink },
  headlineHighlight: { backgroundColor: obColor.tomato, color: '#fff', borderRadius: 10, overflow: 'hidden' },
  track: {
    alignSelf: 'center',
    height: TRACK_HEIGHT,
    borderRadius: 999,
    backgroundColor: obColor.ink,
    borderWidth: 2,
    borderColor: obColor.ink,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  trackFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: obColor.cobalt },
  trackLabel: { fontFamily: obFont.ui700, fontSize: 15.5, color: '#fff', paddingLeft: 40 },
  knob: {
    position: 'absolute',
    top: 5,
    left: 0,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: obColor.sunflower,
    borderWidth: 2,
    borderColor: obColor.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const reelStyles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  avatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#111', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontFamily: obFont.display800, fontSize: 11, color: '#111' },
  bubbleLeft: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#111', borderRadius: 14, borderBottomLeftRadius: 4, paddingVertical: 6, paddingHorizontal: 11 },
  bubbleRight: { backgroundColor: obColor.cobalt, borderWidth: 2, borderColor: '#111', borderRadius: 14, borderBottomRightRadius: 4, paddingVertical: 6, paddingHorizontal: 11 },
  bubbleText: { fontFamily: obFont.ui700, fontSize: 13, color: '#111' },
});
