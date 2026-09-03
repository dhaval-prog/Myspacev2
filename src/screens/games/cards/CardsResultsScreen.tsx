import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '../../../theme';
import { useCardsGame } from '../../../context/CardsGameContext';

interface CardsResultsScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
}

/** Final standings once a game ends — win, an opponent leaving, or emptying a hand. */
export function CardsResultsScreen({ onHome, onOpenExpenses: _onOpenExpenses, onOpenSplit: _onOpenSplit }: CardsResultsScreenProps) {
  const insets = useSafeAreaInsets();
  const { players, result, myPlayerId, leaveGame } = useCardsGame();

  const nameFor = (playerId: string) => players.find((p) => p.id === playerId)?.name ?? 'Someone';
  const winner = result?.rankings.find((r) => r.position === 1);
  const iWon = winner?.playerId === myPlayerId;

  return (
    <LinearGradient
      colors={['#2C1B4D', '#4A2E6E', '#7A4FA0'] as [string, string, ...string[]]}
      locations={[0, 0.5, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.kicker}>GAME OVER</Text>
        {winner && (
          <View style={styles.winnerCard}>
            <Text style={styles.trophy}>🏆</Text>
            <Text style={styles.winnerName}>
              {nameFor(winner.playerId)}
              {iWon ? ' (you)' : ''}
            </Text>
            <Text style={styles.winnerSub}>{iWon ? 'You win!' : 'wins'}</Text>
          </View>
        )}

        <Text style={styles.eyebrow}>FINAL STANDINGS</Text>
        <View style={styles.list}>
          {(result?.rankings ?? []).map((r) => (
            <View key={r.playerId} style={[styles.row, r.playerId === myPlayerId && styles.rowMe]}>
              <Text style={styles.rank}>{r.position}</Text>
              <Text style={styles.name}>
                {nameFor(r.playerId)}
                {r.playerId === myPlayerId ? ' (you)' : ''}
              </Text>
              <Text style={styles.cards}>{r.cardsRemaining} left</Text>
            </View>
          ))}
        </View>

        <Pressable onPress={leaveGame} style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}>
          <Text style={styles.ctaLabel}>New game</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            leaveGame();
            onHome();
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryLabel}>Back to Games</Text>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 26, gap: 14 },
  kicker: { fontFamily: fontFamily.mono500, fontSize: 11.5, letterSpacing: 1.6, textAlign: 'center', color: 'rgba(255,255,255,.5)' },
  winnerCard: { alignItems: 'center', gap: 4, marginBottom: 8 },
  trophy: { fontSize: 56 },
  winnerName: { fontFamily: fontFamily.sans700, fontSize: 26, letterSpacing: -0.6, color: '#fff' },
  winnerSub: { fontFamily: fontFamily.sans400, fontSize: 14, color: 'rgba(255,255,255,.65)' },
  eyebrow: { fontFamily: fontFamily.sans600, fontSize: 11.5, letterSpacing: 1.495, textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,.1)', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 },
  rowMe: { backgroundColor: 'rgba(255,255,255,.2)' },
  rank: { fontFamily: fontFamily.mono500, fontSize: 13, color: 'rgba(255,255,255,.5)', width: 18 },
  name: { flex: 1, fontFamily: fontFamily.sans600, fontSize: 15, color: '#fff' },
  cards: { fontFamily: fontFamily.mono500, fontSize: 13, color: 'rgba(255,255,255,.6)' },
  ctaButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 4,
  },
  ctaLabel: { fontFamily: fontFamily.sans600, fontSize: 16, color: colors.ink },
  secondaryButton: { paddingVertical: 14, alignItems: 'center' },
  secondaryLabel: { fontFamily: fontFamily.sans500, fontSize: 13.5, color: 'rgba(255,255,255,.6)' },
  pressed: { opacity: 0.85 },
});
