import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NpatGlassBackdrop } from '../../../components/npat/NpatGlassBackdrop';
import { PrimaryCta } from '../../../components/spacecards/PrimaryCta';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useTriviaGame } from '../../../context/TriviaGameContext';
import { trColor, trFont } from '../../../theme/triviaTokens';

interface TriviaFinalResultsScreenProps {
  onHome: () => void;
}

/** Winner banner, final leaderboard, and personal stats — the last screen of a Trivia Night. */
export function TriviaFinalResultsScreen({ onHome }: TriviaFinalResultsScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { players, myPlayerId, leaveGame } = useTriviaGame();

  const ranked = players.slice().sort((a, b) => b.score - a.score);
  const winner = ranked[0];
  const me = players.find((p) => p.id === myPlayerId);
  const answeredTotal = me ? me.correctAnswers + me.incorrectAnswers + me.unanswered : 0;
  const accuracy = me && answeredTotal > 0 ? Math.round((me.correctAnswers / answeredTotal) * 100) : 0;

  const backToGames = () => {
    leaveGame();
    onHome();
  };

  return (
    <LinearGradient colors={[trColor.headerTop, trColor.headerMid, trColor.headerBottom]} locations={[0, 0.52, 1]} style={styles.screen}>
      <NpatGlassBackdrop colors={[trColor.blobIndigoDark, trColor.blobLimeDark]} heightMultiplier={1.6} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.trophy}>🏆</Text>
        <Text style={styles.complete}>TRIVIA NIGHT COMPLETE</Text>
        {winner && (
          <>
            <Text style={styles.winnerLabel}>WINNER</Text>
            <Text style={styles.winnerName}>{winner.name}</Text>
            <Text style={styles.winnerScore}>{winner.score.toLocaleString()} POINTS</Text>
          </>
        )}

        <View style={styles.sheet}>
          <BlurView intensity={50} tint="light" style={[StyleSheet.absoluteFill, { zIndex: -1 }]} pointerEvents="none" />
          <View style={styles.sheetTint} pointerEvents="none" />

          <Text style={styles.label}>FINAL LEADERBOARD</Text>
          <View style={styles.rows}>
            {ranked.map((p, i) => (
              <View key={p.id} style={[styles.row, p.id === myPlayerId && styles.rowSelf]}>
                <Text style={styles.rank}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {p.name}
                  {p.id === myPlayerId ? ' (you)' : ''}
                </Text>
                <Text style={styles.score}>{p.score.toLocaleString()}</Text>
              </View>
            ))}
          </View>

          {me && (
            <>
              <Text style={[styles.label, styles.statsLabel]}>YOUR STATS</Text>
              <View style={styles.statsGrid}>
                <StatTile value={me.correctAnswers} label="Correct" />
                <StatTile value={me.incorrectAnswers} label="Incorrect" />
                <StatTile value={me.unanswered} label="Unanswered" />
                <StatTile value={`${accuracy}%`} label="Accuracy" />
                <StatTile value={me.fastestAnswers} label="Fastest answers" />
                <StatTile value={me.score.toLocaleString()} label="Total points" />
              </View>
            </>
          )}

          <View style={styles.ctaWrap}>
            <PrimaryCta label="Back to Games" onPress={backToGames} reduceMotion={reduceMotion} />
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { alignItems: 'center', paddingHorizontal: 22 },
  trophy: { fontSize: 44 },
  complete: { marginTop: 4, fontFamily: trFont.mono500, fontSize: 11, letterSpacing: 11 * 0.14, color: trColor.onDark60 },
  winnerLabel: { marginTop: 20, fontFamily: trFont.mono500, fontSize: 10, letterSpacing: 10 * 0.14, color: trColor.lime },
  winnerName: { marginTop: 4, fontFamily: trFont.sans800, fontSize: 30, color: '#FFFFFF' },
  winnerScore: { marginTop: 2, fontFamily: trFont.sans700, fontSize: 15, color: trColor.onDark60 },
  sheet: {
    marginTop: 26,
    width: '100%',
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: trColor.glassBorder,
    padding: 22,
    gap: 14,
  },
  sheetTint: { position: 'absolute', zIndex: -1, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: trColor.sheetGlassFill },
  label: { fontFamily: trFont.mono500, fontSize: 9.5, letterSpacing: 9.5 * 0.12, color: trColor.fieldLabel, textTransform: 'uppercase' },
  statsLabel: { marginTop: 4 },
  rows: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: trColor.rowGlassFill,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: trColor.rowGlassBorder,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  rowSelf: { backgroundColor: 'rgba(195,234,79,.22)', borderColor: trColor.lime },
  rank: { width: 26, fontFamily: trFont.sans700, fontSize: 15, textAlign: 'center' },
  name: { flex: 1, fontFamily: trFont.sans700, fontSize: 14, color: trColor.ink },
  score: { fontFamily: trFont.sans700, fontSize: 15, color: trColor.ink },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statTile: {
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 3,
    backgroundColor: trColor.rowGlassFill,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: trColor.rowGlassBorder,
    paddingVertical: 14,
  },
  statValue: { fontFamily: trFont.sans800, fontSize: 19, color: trColor.ink },
  statLabel: { fontFamily: trFont.sans400, fontSize: 10.5, color: trColor.fieldLabel, textAlign: 'center' },
  ctaWrap: { marginTop: 4 },
});
