import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { BottomNav } from '../../components/BottomNav';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const BACK_ICON = 'M15 5l-7 7 7 7';
const CHEVRON_ICON = 'M9 6l6 6-6 6';

interface GamesHomeScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  onOpenNpat: () => void;
  onOpenCards: () => void;
}

interface GameCardData {
  id: string;
  title: string;
  blurb: string;
  emoji: string;
  bg: string;
  onPress: () => void;
}

/** The Games catalog — Home's "Games" row lands here, then a specific game. */
export function GamesHomeScreen({ onHome, onOpenExpenses, onOpenSplit, onOpenNpat, onOpenCards }: GamesHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const games: GameCardData[] = [
    { id: 'npat', title: 'Name, Place, Animal, Thing', blurb: 'Race the clock, beat the letter.', emoji: '🎯', bg: colors.ink, onPress: onOpenNpat },
    { id: 'cards', title: 'My Space Cards', blurb: 'Shed your hand before anyone else.', emoji: '🃏', bg: '#2C1B4D', onPress: onOpenCards },
  ];

  return (
    <LinearGradient
      colors={colors.friendsCanvas as [string, string, ...string[]]}
      locations={colors.friendsCanvasStops as [number, number, ...number[]]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
      <ScrollView style={styles.scrollFlex} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Games</Text>
          <Text style={styles.sub}>Play with friends</Text>
        </View>

        <View style={styles.list}>
          {games.map((g) => (
            <Pressable
              key={g.id}
              onPress={g.onPress}
              style={({ pressed }) => [styles.card, { backgroundColor: g.bg }, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Play ${g.title}`}
            >
              <Text style={styles.cardEmoji}>{g.emoji}</Text>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{g.title}</Text>
                <Text style={styles.cardBlurb}>{g.blurb}</Text>
              </View>
              <View style={styles.playChip}>
                <Text style={styles.playLabel}>Play</Text>
                <Icon path={CHEVRON_ICON} color={colors.ink} size={14} strokeWidth={2.2} />
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.pinned}>
        <Pressable onPress={onHome} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back to Home">
          <Icon path={BACK_ICON} color={colors.textPrimary} size={18} strokeWidth={2} />
        </Pressable>
      </View>

      <BottomNav
        activeId="games"
        onSelect={(id) => {
          if (id === 'home') onHome();
          if (id === 'expenses') onOpenExpenses();
          if (id === 'split') onOpenSplit();
        }}
        bottomInset={insets.bottom}
        reduceMotion={reduceMotion}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollFlex: { flex: 1 },
  scroll: { paddingHorizontal: 26, paddingBottom: spacing.lg, gap: 14 },
  pinned: { paddingHorizontal: 26, paddingTop: spacing.ms, paddingBottom: spacing.ms },
  headerRow: { gap: 2 },
  title: { fontFamily: fontFamily.sans700, fontSize: 30, lineHeight: 31.5, letterSpacing: -0.9, color: colors.textPrimary },
  sub: { fontFamily: fontFamily.sans400, fontSize: 13.5, color: colors.textSecondary },
  list: { gap: 14, marginTop: 6 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 26,
    paddingVertical: 20,
    paddingHorizontal: 20,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 3,
  },
  pressed: { opacity: 0.9 },
  cardEmoji: { fontSize: 34 },
  cardText: { flex: 1, gap: 3 },
  cardTitle: { fontFamily: fontFamily.sans600, fontSize: 16.5, color: '#fff' },
  cardBlurb: { fontFamily: fontFamily.sans400, fontSize: 12.5, color: 'rgba(255,255,255,.6)' },
  playChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.lime,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  playLabel: { fontFamily: fontFamily.sans600, fontSize: 13, color: colors.ink },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 1,
  },
});
