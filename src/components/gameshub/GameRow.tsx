import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../Icon';
import { ghColor, ghFont } from '../../theme/gamesHubTokens';

const CHEV_ICON = 'M9 6l6 6-6 6';
const BODY_HEIGHT = 74;

function NpatIcon() {
  return (
    <View style={styles.npatIconRow}>
      <View style={[styles.npatTile, { backgroundColor: ghColor.gradientPink, transform: [{ rotate: '-8deg' }] }]}>
        <Text style={[styles.npatTileLabel, { color: ghColor.textOnGradient }]}>N</Text>
      </View>
      <View style={[styles.npatTile, { backgroundColor: 'rgba(255,255,255,.92)', transform: [{ rotate: '4deg' }] }]}>
        <Text style={styles.npatTileLabel}>P</Text>
      </View>
      <View style={[styles.npatTile, { backgroundColor: ghColor.gradientPink, transform: [{ rotate: '-3deg' }] }]}>
        <Text style={[styles.npatTileLabel, { color: ghColor.textOnGradient }]}>A</Text>
      </View>
    </View>
  );
}

const CARD_MINIS = [
  { left: 0, top: 1, rotate: '-14deg', suit: '#E8533B' },
  { left: 18, top: 0, rotate: '-2deg', suit: '#2F93D8' },
  { left: 36, top: 1, rotate: '11deg', suit: '#2F9E4F' },
];

function CardsIcon() {
  return (
    <View style={styles.cardsIconWrap}>
      {CARD_MINIS.map((c, i) => (
        <View key={i} style={[styles.cardMini, { left: c.left, top: c.top, transform: [{ rotate: c.rotate }] }]}>
          <View style={[styles.cardMiniOval, { backgroundColor: c.suit }]} />
        </View>
      ))}
    </View>
  );
}

interface GameRowProps {
  variant: 'npat' | 'cards';
  title: string;
  subtitle: string;
  expanded: boolean;
  onToggle: () => void;
  onCreate: () => void;
  onJoin: () => void;
}

/** One expandable "Play a game" row — tap to reveal Create/Join, matching the handoff's in-place expand instead of pushing a new screen. */
export function GameRow({ variant, title, subtitle, expanded, onToggle, onCreate, onJoin }: GameRowProps) {
  const bodyProgress = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const chevProgress = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(bodyProgress, { toValue: expanded ? 1 : 0, duration: 340, easing: Easing.bezier(0.2, 0.85, 0.25, 1), useNativeDriver: false }).start();
    Animated.timing(chevProgress, { toValue: expanded ? 1 : 0, duration: 300, easing: Easing.bezier(0.2, 0.85, 0.25, 1), useNativeDriver: true }).start();
  }, [expanded, bodyProgress, chevProgress]);

  const bodyHeight = bodyProgress.interpolate({ inputRange: [0, 1], outputRange: [0, BODY_HEIGHT] });
  const chevRotate = chevProgress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
  const isNpat = variant === 'npat';
  const glassFill = isNpat ? ghColor.npatGlassFill : ghColor.cardsGlassFill;
  const glassBorder = isNpat ? ghColor.npatGlassBorder : ghColor.cardsGlassBorder;
  const accent = isNpat ? ghColor.gradientPink : ghColor.gradientBlue;

  return (
    <View style={[styles.card, { borderColor: glassBorder }, expanded && [styles.cardExpanded, { borderColor: accent, shadowColor: accent }]]}>
      <BlurView intensity={34} tint="dark" style={[StyleSheet.absoluteFill, { zIndex: -1 }]} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: glassFill }]} pointerEvents="none" />
      <Pressable onPress={onToggle} style={styles.header} accessibilityRole="button" accessibilityLabel={title}>
        {variant === 'npat' ? <NpatIcon /> : <CardsIcon />}
        <View style={styles.headerMid}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSub}>{subtitle}</Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: chevRotate }] }}>
          <Icon path={CHEV_ICON} color={ghColor.textSecondary} size={16} strokeWidth={2.2} />
        </Animated.View>
      </Pressable>
      <Animated.View style={[styles.body, { height: bodyHeight, opacity: bodyProgress }]}>
        <View style={styles.bodyRow}>
          <Pressable onPress={onCreate} style={styles.createBtn} accessibilityRole="button">
            <LinearGradient colors={[ghColor.gradientPink, ghColor.gradientBlue]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <Text style={styles.createLabel}>Create a game</Text>
          </Pressable>
          <Pressable onPress={onJoin} style={styles.joinBtn} accessibilityRole="button">
            <Text style={styles.joinLabel}>Join with code</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: ghColor.ink,
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
  },
  cardExpanded: { borderWidth: 2, shadowOpacity: 0.32, shadowRadius: 30 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16 },
  headerMid: { flex: 1 },
  headerTitle: { fontFamily: ghFont.sans700, fontSize: 15, lineHeight: 17.25, color: '#FFFFFF' },
  headerSub: { fontFamily: ghFont.sans400, fontSize: 11, color: ghColor.textTertiary, marginTop: 4 },
  body: { overflow: 'hidden' },
  bodyRow: { flexDirection: 'row', gap: 9, paddingHorizontal: 16, paddingBottom: 15 },
  createBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, overflow: 'hidden' },
  createLabel: { fontFamily: ghFont.sans700, fontSize: 13.5, color: ghColor.textOnGradient },
  joinBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: ghColor.surfaceStrong, borderWidth: 1, borderColor: ghColor.hairline },
  joinLabel: { fontFamily: ghFont.sans600, fontSize: 13.5, color: '#FFFFFF' },
  npatIconRow: { flexDirection: 'row', gap: 3, flexShrink: 0 },
  npatTile: { width: 20, height: 26, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  npatTileLabel: { fontFamily: ghFont.sans800, fontSize: 12, color: ghColor.ink },
  cardsIconWrap: { width: 62, height: 30, flexShrink: 0 },
  cardMini: {
    position: 'absolute',
    width: 22,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  cardMiniOval: { width: 15, height: 21, borderRadius: 999, transform: [{ rotate: '-22deg' }] },
});
