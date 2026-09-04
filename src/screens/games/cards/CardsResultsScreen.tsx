import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryCta } from '../../../components/spacecards/PrimaryCta';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useCardsGame } from '../../../context/CardsGameContext';
import { scColor, scFont } from '../../../theme/spaceCardsTokens';

interface CardsResultsScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
}

/** Final standings once a game ends — win, an opponent leaving, or emptying a hand. */
export function CardsResultsScreen({ onHome, onOpenExpenses: _onOpenExpenses, onOpenSplit: _onOpenSplit }: CardsResultsScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { players, result, myPlayerId, leaveGame } = useCardsGame();

  const nameFor = (playerId: string) => players.find((p) => p.id === playerId)?.name ?? 'Someone';
  const winner = result?.rankings.find((r) => r.position === 1);
  const iWon = winner?.playerId === myPlayerId;

  return (
    <LinearGradient colors={[scColor.sheet1, scColor.sheet2, scColor.sheet3]} locations={[0, 0.5, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.kicker}>GAME OVER</Text>
        {winner && (
          <View style={styles.winnerCard}>
            <View style={styles.winnerBadge}>
              <Text style={styles.winnerBadgeLabel}>1</Text>
            </View>
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

        <PrimaryCta label="New game" onPress={leaveGame} reduceMotion={reduceMotion} />

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
  kicker: { fontFamily: scFont.mono500, fontSize: 11.5, letterSpacing: 1.6, textAlign: 'center', color: 'rgba(255,255,255,.5)' },
  winnerCard: { alignItems: 'center', gap: 6, marginBottom: 8 },
  winnerBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: scColor.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  winnerBadgeLabel: { fontFamily: scFont.sans800, fontSize: 26, color: scColor.ink },
  winnerName: { fontFamily: scFont.sans700, fontSize: 26, letterSpacing: -0.6, color: '#fff' },
  winnerSub: { fontFamily: scFont.sans400, fontSize: 14, color: 'rgba(255,255,255,.65)' },
  eyebrow: { fontFamily: scFont.mono500, fontSize: 11.5, letterSpacing: 1.495, textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,.1)', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 },
  rowMe: { backgroundColor: 'rgba(255,255,255,.2)' },
  rank: { fontFamily: scFont.mono500, fontSize: 13, color: 'rgba(255,255,255,.5)', width: 18 },
  name: { flex: 1, fontFamily: scFont.sans600, fontSize: 15, color: '#fff' },
  cards: { fontFamily: scFont.mono500, fontSize: 13, color: 'rgba(255,255,255,.6)' },
  secondaryButton: { paddingVertical: 14, alignItems: 'center' },
  secondaryLabel: { fontFamily: scFont.sans500, fontSize: 13.5, color: 'rgba(255,255,255,.6)' },
  pressed: { opacity: 0.85 },
});
