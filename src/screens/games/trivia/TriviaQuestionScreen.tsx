import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NpatGlassBackdrop } from '../../../components/npat/NpatGlassBackdrop';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useTriviaGame } from '../../../context/TriviaGameContext';
import { trColor, trFont, trMotion } from '../../../theme/triviaTokens';

/** Local, display-only countdown — the server's `ends_at` is the only real deadline; this just renders it. */
function useCountdown(endsAt: string | null): number {
  const [secondsLeft, setSecondsLeft] = useState(() => (endsAt ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000)) : 0));

  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  return secondsLeft;
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Scales the timer up and down in a tight loop once time is nearly out — a purely visual nudge, the real deadline is still only `endsAt`. */
function useUrgentPulse(urgent: boolean, reduceMotion: boolean): Animated.Value {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!urgent || reduceMotion) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: trMotion.urgentPulseMs / 2, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: trMotion.urgentPulseMs / 2, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [urgent, reduceMotion, pulse]);
  return pulse;
}

/**
 * Per-answer-option scale/opacity used the moment a choice locks in: the
 * selected card pops slightly, the rest fade back — purely cosmetic, driven
 * off `myAnswer` rather than anything server-authoritative.
 */
function useAnswerLockAnim(optionIds: string[], selectedId: string | null, reduceMotion: boolean) {
  const anims = useRef<Record<string, Animated.Value>>({}).current;
  optionIds.forEach((id) => {
    if (!anims[id]) anims[id] = new Animated.Value(1);
  });

  useEffect(() => {
    optionIds.forEach((id) => anims[id]?.setValue(1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionIds.join('|')]);

  useEffect(() => {
    if (!selectedId || reduceMotion) return;
    optionIds.forEach((id) => {
      const anim = anims[id];
      if (!anim) return;
      if (id === selectedId) {
        Animated.sequence([
          Animated.timing(anim, { toValue: 1.05, duration: trMotion.answerLockMs / 2, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 1, duration: trMotion.answerLockMs / 2, useNativeDriver: true }),
        ]).start();
      } else {
        Animated.timing(anim, { toValue: 0.94, duration: trMotion.answerLockMs, useNativeDriver: true }).start();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, reduceMotion]);

  return anims;
}

/** The primary in-game screen: question, timer, four answer options. Locks the moment you answer; never reveals correctness until the question is revealed. */
export function TriviaQuestionScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { game, currentQuestion, myPlayerId, players, myAnswer, submitAnswer, submittingAnswer, answerError } = useTriviaGame();
  const secondsLeft = useCountdown(currentQuestion?.endsAt ?? null);
  const urgent = secondsLeft <= 5;
  const me = players.find((p) => p.id === myPlayerId);
  const pulse = useUrgentPulse(urgent, reduceMotion);
  const optionIds = currentQuestion?.answers.map((a) => a.id) ?? [];
  const lockAnims = useAnswerLockAnim(optionIds, myAnswer?.answerId ?? null, reduceMotion);

  if (!game || !currentQuestion) return null;

  const locked = !!myAnswer || submittingAnswer;

  return (
    <LinearGradient colors={[trColor.headerTop, trColor.headerMid, trColor.headerBottom]} locations={[0, 0.52, 1]} style={styles.screen}>
      <NpatGlassBackdrop colors={[trColor.blobIndigoDark, trColor.blobLimeDark]} />
      <View style={[styles.topBar, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.topLabel}>
          Question {currentQuestion.questionIndex + 1} / {game.questionCount}
        </Text>
        <Text style={styles.topLabel}>{me?.score ?? 0} points</Text>
      </View>

      <Animated.Text style={[styles.timer, urgent && styles.timerUrgent, { transform: [{ scale: pulse }] }]}>{formatClock(secondsLeft)}</Animated.Text>

      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sheet}>
          <BlurView intensity={50} tint="light" style={[StyleSheet.absoluteFill, { zIndex: -1 }]} pointerEvents="none" />
          <View style={styles.sheetTint} pointerEvents="none" />
          <Text style={styles.category}>{currentQuestion.category.toUpperCase()}</Text>
          <Text style={styles.question}>{currentQuestion.questionText}</Text>

          <View style={styles.answers}>
            {currentQuestion.answers.map((option) => {
              const selected = myAnswer?.answerId === option.id;
              return (
                <Animated.View key={option.id} style={{ transform: [{ scale: lockAnims[option.id] ?? 1 }] }}>
                  <Pressable
                    onPress={() => {
                      if (!locked) submitAnswer(option.id);
                    }}
                    disabled={locked}
                    style={({ pressed }) => [
                      styles.answerCard,
                      selected && styles.answerCardSelected,
                      locked && !selected && styles.answerCardDisabled,
                      pressed && !locked && styles.answerCardPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${option.id.toUpperCase()}. ${option.text}`}
                    accessibilityState={{ disabled: locked, selected }}
                  >
                    <Text style={[styles.answerLetter, selected && styles.answerLetterSelected]}>{option.id.toUpperCase()}</Text>
                    <Text style={[styles.answerText, selected && styles.answerTextSelected]} numberOfLines={3}>
                      {option.text}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>

          {answerError && <Text style={styles.error}>{answerError}</Text>}
          {locked && (
            <View style={styles.lockedRow}>
              <View style={styles.lockedDot} />
              <Text style={styles.lockedLabel}>Answer locked — waiting for the others…</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 22 },
  topLabel: { fontFamily: trFont.mono500, fontSize: 11, letterSpacing: 11 * 0.08, color: trColor.onDark60, textTransform: 'uppercase' },
  timer: {
    marginTop: 18,
    alignSelf: 'center',
    fontFamily: trFont.sans800,
    fontSize: 44,
    letterSpacing: -1,
    color: '#FFFFFF',
  },
  timerUrgent: { color: '#FF6B5C' },
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
    paddingTop: 20,
    paddingBottom: 30,
    gap: 16,
  },
  sheetTint: { position: 'absolute', zIndex: -1, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: trColor.sheetGlassFill },
  category: { fontFamily: trFont.mono500, fontSize: 9.5, letterSpacing: 9.5 * 0.14, color: trColor.fieldLabel, textAlign: 'center' },
  question: { fontFamily: trFont.sans700, fontSize: 21, lineHeight: 27, color: trColor.ink, textAlign: 'center' },
  answers: { gap: 10 },
  answerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: trColor.rowGlassBorder,
  },
  answerCardPressed: { opacity: 0.85 },
  answerCardSelected: { backgroundColor: trColor.ink, borderColor: trColor.ink },
  answerCardDisabled: { opacity: 0.45 },
  answerLetter: { fontFamily: trFont.sans800, fontSize: 15, color: trColor.ink, width: 20 },
  answerLetterSelected: { color: trColor.lime },
  answerText: { flex: 1, fontFamily: trFont.sans600, fontSize: 15, color: trColor.ink },
  answerTextSelected: { color: '#FFFFFF' },
  error: { fontFamily: trFont.sans500, fontSize: 12.5, color: '#D33243', textAlign: 'center' },
  lockedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  lockedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: trColor.ready },
  lockedLabel: { fontFamily: trFont.sans500, fontSize: 12.5, color: trColor.fieldLabel },
});
