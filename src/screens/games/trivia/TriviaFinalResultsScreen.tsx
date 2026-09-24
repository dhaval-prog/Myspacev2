import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NpatGlassBackdrop } from '../../../components/npat/NpatGlassBackdrop';
import { PrimaryCta } from '../../../components/spacecards/PrimaryCta';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useTriviaGame } from '../../../context/TriviaGameContext';
import { trColor, trFont, trMotion } from '../../../theme/triviaTokens';

interface TriviaFinalResultsScreenProps {
  onHome: () => void;
}

const CONFETTI = ['🎉', '✨', '🎊', '⭐', '💛', '🎉', '✨', '🎊', '⭐', '💛'];
const CONFETTI_X = [-150, -112, -74, -36, 2, 40, 78, 116, -130, 60];

/** A one-shot, non-looping confetti burst over the winner banner — skipped entirely under reduce-motion. */
function TriviaConfetti() {
  const anims = useRef(CONFETTI.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      trMotion.confettiStaggerMs,
      anims.map((v) => Animated.timing(v, { toValue: 1, duration: trMotion.confettiFallMs, easing: Easing.out(Easing.quad), useNativeDriver: true })),
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.confettiLayer} pointerEvents="none">
      {CONFETTI.map((emoji, i) => {
        const translateY = anims[i].interpolate({ inputRange: [0, 1], outputRange: [-16, 220] });
        const rotate = anims[i].interpolate({ inputRange: [0, 1], outputRange: ['0deg', i % 2 === 0 ? '340deg' : '-340deg'] });
        const opacity = anims[i].interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });
        return (
          <Animated.Text key={i} style={[styles.confettiPiece, { left: 195 + CONFETTI_X[i], opacity, transform: [{ translateY }, { rotate }] }]}>
            {emoji}
          </Animated.Text>
        );
      })}
    </View>
  );
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

  const trophyAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const winnerAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.spring(trophyAnim, { toValue: 1, useNativeDriver: true, friction: 4, tension: 60 }).start();
    Animated.timing(winnerAnim, {
      toValue: 1,
      duration: trMotion.winnerEntranceMs,
      delay: trMotion.winnerEntranceDelayMs,
      easing: trMotion.easeEntrance,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToGames = () => {
    leaveGame();
    onHome();
  };

  return (
    <LinearGradient colors={[trColor.headerTop, trColor.headerMid, trColor.headerBottom]} locations={[0, 0.52, 1]} style={styles.screen}>
      <NpatGlassBackdrop colors={[trColor.blobIndigoDark, trColor.blobLimeDark]} heightMultiplier={1.6} />
      {!reduceMotion && winner && <TriviaConfetti />}
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <Animated.Text
          style={[
            styles.trophy,
            { transform: [{ scale: trophyAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
          ]}
        >
          🏆
        </Animated.Text>
        <Text style={styles.complete}>TRIVIA NIGHT COMPLETE</Text>
        {winner && (
          <Animated.View
            style={{
              alignItems: 'center',
              opacity: winnerAnim,
              transform: [{ translateY: winnerAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }}
          >
            <Text style={styles.winnerLabel}>WINNER</Text>
            <Text style={styles.winnerName}>{winner.name}</Text>
            <Text style={styles.winnerScore}>{winner.score.toLocaleString()} POINTS</Text>
          </Animated.View>
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
  confettiLayer: { position: 'absolute', top: 0, left: 0, right: 0, height: 260, zIndex: 1 },
  confettiPiece: { position: 'absolute', top: 0, fontSize: 22 },
});
