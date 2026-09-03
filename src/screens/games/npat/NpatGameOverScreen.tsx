import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '../../../theme';
import { useGame } from '../../../context/GameContext';

interface NpatGameOverScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
}

/** Final standings once every round has resolved. No rematch RPC yet — "New game" just clears this session's game and drops back to the create/join hub. */
export function NpatGameOverScreen({ onHome, onOpenExpenses: _onOpenExpenses, onOpenSplit: _onOpenSplit }: NpatGameOverScreenProps) {
  const insets = useSafeAreaInsets();
  const { players, myPlayerId, leaveGame } = useGame();

  const standings = players.filter((p) => p.active || p.totalScore > 0).sort((a, b) => b.totalScore - a.totalScore);
  const winner = standings[0];

  return (
    <LinearGradient
      colors={colors.friendsCanvas as [string, string, ...string[]]}
      locations={colors.friendsCanvasStops as [number, number, ...number[]]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.kicker}>GAME COMPLETE</Text>
        {winner && (
          <View style={styles.winnerCard}>
            <Text style={styles.trophy}>🏆</Text>
            <Text style={styles.winnerName}>{winner.name}{winner.id === myPlayerId ? ' (you)' : ''}</Text>
            <Text style={styles.winnerSub}>wins with {winner.totalScore} points</Text>
          </View>
        )}

        <Text style={styles.eyebrow}>FINAL STANDINGS</Text>
        <View style={styles.list}>
          {standings.map((p, i) => (
            <View key={p.id} style={[styles.row, p.id === myPlayerId && styles.rowMe]}>
              <Text style={styles.rank}>{i + 1}</Text>
              <Text style={styles.name}>
                {p.name}
                {p.id === myPlayerId ? ' (you)' : ''}
              </Text>
              <Text style={styles.score}>{p.totalScore}</Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => {
            leaveGame();
          }}
          style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}
        >
          <Text style={styles.ctaLabel}>New game</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            leaveGame();
            onHome();
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryLabel}>Back to Home</Text>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 26, gap: 14, alignItems: 'stretch' },
  kicker: {
    fontFamily: fontFamily.mono500,
    fontSize: 11.5,
    letterSpacing: 1.6,
    textAlign: 'center',
    color: colors.textFaint,
  },
  winnerCard: { alignItems: 'center', gap: 4, marginBottom: 8 },
  trophy: { fontSize: 56 },
  winnerName: { fontFamily: fontFamily.sans700, fontSize: 26, letterSpacing: -0.6, color: colors.textPrimary },
  winnerSub: { fontFamily: fontFamily.sans400, fontSize: 14, color: colors.textSecondary },
  eyebrow: {
    fontFamily: fontFamily.sans600,
    fontSize: 11.5,
    letterSpacing: 1.495,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,.7)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowMe: { backgroundColor: 'rgba(255,255,255,.95)' },
  rank: { fontFamily: fontFamily.mono500, fontSize: 13, color: colors.ink50, width: 18 },
  name: { flex: 1, fontFamily: fontFamily.sans600, fontSize: 15, color: colors.textPrimary },
  score: { fontFamily: fontFamily.mono500, fontSize: 16, color: colors.textPrimary },
  ctaButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#7AA82C',
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 4,
  },
  ctaLabel: { fontFamily: fontFamily.sans600, fontSize: 16, color: colors.ink },
  secondaryButton: { paddingVertical: 14, alignItems: 'center' },
  secondaryLabel: { fontFamily: fontFamily.sans500, fontSize: 13.5, color: colors.textSecondary },
  pressed: { opacity: 0.85 },
});
