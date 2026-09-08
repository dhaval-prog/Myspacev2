import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NpatGlassBackdrop } from '../../../components/npat/NpatGlassBackdrop';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useTriviaGame } from '../../../context/TriviaGameContext';
import { trColor, trFont, trMotion } from '../../../theme/triviaTokens';

function useSecondsUntil(target: string | null): number {
  const [secondsLeft, setSecondsLeft] = useState(() => (target ? Math.max(0, Math.ceil((new Date(target).getTime() - Date.now()) / 1000)) : 0));
  useEffect(() => {
    if (!target) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((new Date(target).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [target]);
  return secondsLeft;
}

/** Correct answer + every player's result for this question, then a running leaderboard — the reveal and leaderboard moments combined into one screen. */
export function TriviaRevealScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { currentQuestion, correctAnswerId, answers, players, myPlayerId } = useTriviaGame();
  const secondsLeft = useSecondsUntil(currentQuestion?.revealEndsAt ?? null);

  const ranked = players
    .filter((p) => p.active)
    .slice()
    .sort((a, b) => b.score - a.score);

  // This screen mounts fresh every time a question is revealed (the parent
  // swaps it in/out), so a plain mount-time entrance is enough — no need to
  // key anything off the question id.
  const bannerAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const [rowAnims] = useState(() => ranked.map(() => new Animated.Value(reduceMotion ? 1 : 0)));

  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(bannerAnim, { toValue: 1, duration: trMotion.revealEntranceMs, easing: trMotion.easeEntrance, useNativeDriver: true }).start();
    Animated.stagger(
      trMotion.revealStaggerMs,
      rowAnims.map((v) => Animated.timing(v, { toValue: 1, duration: trMotion.revealEntranceMs, easing: trMotion.easeEntrance, useNativeDriver: true })),
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!currentQuestion) return null;

  const correctText = currentQuestion.answers.find((a) => a.id === correctAnswerId)?.text ?? '—';

  return (
    <LinearGradient colors={[trColor.headerTop, trColor.headerMid, trColor.headerBottom]} locations={[0, 0.52, 1]} style={styles.screen}>
      <NpatGlassBackdrop colors={[trColor.blobIndigoDark, trColor.blobLimeDark]} />
      <Animated.View
        style={{
          paddingTop: insets.top + 18,
          opacity: bannerAnim,
          transform: [{ translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        }}
      >
        <Text style={styles.correctLabel}>✓ CORRECT ANSWER</Text>
        <Text style={styles.correctText}>{correctText}</Text>
      </Animated.View>

      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sheet}>
          <BlurView intensity={50} tint="light" style={[StyleSheet.absoluteFill, { zIndex: -1 }]} pointerEvents="none" />
          <View style={styles.sheetTint} pointerEvents="none" />
          <Text style={styles.label}>LEADERBOARD</Text>

          <View style={styles.rows}>
            {ranked.map((p, i) => {
              const answer = answers.find((a) => a.playerId === p.id);
              const isMe = p.id === myPlayerId;
              const rowAnim = rowAnims[i];
              const rowStyle = rowAnim
                ? {
                    opacity: rowAnim,
                    transform: [{ translateY: rowAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
                  }
                : undefined;
              const pointsScale = rowAnim ? rowAnim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.4, 1.2, 1] }) : 1;
              return (
                <Animated.View key={p.id} style={[styles.row, isMe && styles.rowSelf, rowStyle]}>
                  <Text style={styles.rank}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</Text>
                  <View style={styles.rowMid}>
                    <Text style={styles.name} numberOfLines={1}>
                      {p.name}
                      {isMe ? ' (you)' : ''}
                    </Text>
                    <Text style={[styles.resultNote, answer?.isCorrect ? styles.correctNote : answer ? styles.incorrectNote : styles.noAnswerNote]}>
                      {answer ? (answer.isCorrect ? '✓ Correct' : '✕ Incorrect') : 'No answer'}
                    </Text>
                  </View>
                  <View style={styles.scoreCol}>
                    {answer && answer.points > 0 && (
                      <Animated.Text style={[styles.pointsGained, { transform: [{ scale: pointsScale }] }]}>+{answer.points}</Animated.Text>
                    )}
                    <Text style={styles.totalScore}>{p.score}</Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>

          <Text style={styles.nextHint}>Next question in {secondsLeft}…</Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  correctLabel: {
    textAlign: 'center',
    fontFamily: trFont.mono500,
    fontSize: 10,
    letterSpacing: 10 * 0.14,
    color: trColor.lime,
  },
  correctText: {
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 22,
    fontFamily: trFont.sans800,
    fontSize: 22,
    color: '#FFFFFF',
  },
  scrollFlex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
  sheet: {
    marginTop: 18,
    overflow: 'hidden',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: trColor.glassBorder,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 12,
  },
  sheetTint: { position: 'absolute', zIndex: -1, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: trColor.sheetGlassFill },
  label: { fontFamily: trFont.mono500, fontSize: 9.5, letterSpacing: 9.5 * 0.12, color: trColor.fieldLabel, textTransform: 'uppercase' },
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
  rowMid: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: trFont.sans700, fontSize: 14, color: trColor.ink },
  resultNote: { fontFamily: trFont.sans500, fontSize: 11.5 },
  correctNote: { color: trColor.correct },
  incorrectNote: { color: trColor.incorrect },
  noAnswerNote: { color: trColor.fieldLabel },
  scoreCol: { alignItems: 'flex-end', gap: 1 },
  pointsGained: { fontFamily: trFont.mono500, fontSize: 11.5, color: trColor.correct },
  totalScore: { fontFamily: trFont.sans700, fontSize: 15, color: trColor.ink },
  nextHint: { textAlign: 'center', fontFamily: trFont.sans400, fontSize: 11.5, color: trColor.fieldLabel },
});
