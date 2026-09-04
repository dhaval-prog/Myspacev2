import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, noOutline, radius, spacing } from '../../../theme';
import { useGame } from '../../../context/GameContext';

/** Seconds remaining at which the countdown starts escalating in urgency. */
const WARN_AT = 20;
const DANGER_AT = 10;

function useCountdown(endTime: string | undefined): number {
  const [remaining, setRemaining] = useState(() => (endTime ? Math.max(0, Math.ceil((new Date(endTime).getTime() - Date.now()) / 1000)) : 0));
  useEffect(() => {
    if (!endTime) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((new Date(endTime).getTime() - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [endTime]);
  return remaining;
}

/** Live round: big letter, escalating countdown, one field per category. Submitting is final for this round — there's no edit-after-submit. */
export function NpatRoundScreen() {
  const insets = useSafeAreaInsets();
  const { game, round, players, myPlayerId, hasSubmittedAll, submitAnswers, leaveGame } = useGame();
  const remaining = useCountdown(round?.status === 'playing' ? round.endTime : undefined);

  const categories = game?.categories ?? [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh inputs for a fresh round.
  useEffect(() => {
    setValues({});
    setError(null);
  }, [round?.id]);

  const locked = round?.status !== 'playing' || hasSubmittedAll;
  const urgency = remaining <= DANGER_AT ? 'danger' : remaining <= WARN_AT ? 'warn' : 'normal';

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const answers = categories.map((c) => ({ category: c, answer: values[c] ?? '' }));
    const { error: err } = await submitAnswers(answers);
    setSubmitting(false);
    if (err) setError(err);
  };

  // Refs kept current every render so the deadline timer below always reads
  // the latest typed values/categories/submitAnswers without needing them in
  // its dependency array (submitAnswers is a new closure every GameProvider
  // render, so depending on it directly would keep re-arming the timeout).
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const submitAnswersRef = useRef(submitAnswers);
  submitAnswersRef.current = submitAnswers;
  const hasSubmittedAllRef = useRef(hasSubmittedAll);
  hasSubmittedAllRef.current = hasSubmittedAll;
  const autoSubmittedForRound = useRef<string | null>(null);

  // Whatever's typed gets sent the instant the clock runs out, even if the
  // player never pressed Submit — otherwise every category silently scores
  // 0 the moment the round locks. Fires slightly before the server's own
  // end_time (which submit_round_answers strictly enforces) so the request
  // has time to land before the deadline it's racing against.
  useEffect(() => {
    if (!round || round.status !== 'playing') return;
    const msLeft = new Date(round.endTime).getTime() - Date.now() - 400;
    const timer = setTimeout(() => {
      if (autoSubmittedForRound.current === round.id || hasSubmittedAllRef.current) return;
      autoSubmittedForRound.current = round.id;
      const answers = categoriesRef.current.map((c) => ({ category: c, answer: valuesRef.current[c] ?? '' }));
      submitAnswersRef.current(answers);
    }, Math.max(0, msLeft));
    return () => clearTimeout(timer);
  }, [round?.id, round?.status, round?.endTime]);

  if (!round || !game) return null;

  const activeCount = players.filter((p) => p.active).length;
  const submittedCount = players.filter((p) => p.active && p.submittedRoundId === round.id).length;
  const stillWaitingOn = Math.max(0, activeCount - submittedCount);

  return (
    <View style={[styles.screen, urgency === 'danger' && styles.screenDanger]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.roundLabel}>ROUND {round.roundNumber} OF {game.roundsTotal}</Text>

        <View style={styles.letterWrap}>
          <Text style={styles.letter}>{round.letter}</Text>
        </View>

        <Text style={[styles.timer, urgency === 'warn' && styles.timerWarn, urgency === 'danger' && styles.timerDanger]}>
          {locked ? (round.status === 'playing' ? 'Locked in!' : 'Time!') : `${remaining}s`}
        </Text>

        {!locked ? (
          <View style={styles.form}>
            {categories.map((category) => (
              <View key={category} style={styles.field}>
                <Text style={styles.fieldLabel}>{category}</Text>
                <TextInput
                  value={values[category] ?? ''}
                  onChangeText={(t) => setValues((prev) => ({ ...prev, [category]: t }))}
                  placeholder={`Starts with "${round.letter}"`}
                  placeholderTextColor="rgba(255,255,255,.35)"
                  autoCapitalize="words"
                  autoCorrect={false}
                  style={[styles.input, noOutline]}
                />
              </View>
            ))}

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable onPress={handleSubmit} disabled={submitting} style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}>
              <Text style={styles.submitLabel}>{submitting ? 'Submitting…' : 'Submit answers'}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.waitingCard}>
            <Text style={styles.waitingTitle}>{hasSubmittedAll ? "You're locked in" : 'Round locked'}</Text>
            <Text style={styles.waitingBody}>
              {categories.map((c) => `${c}: ${values[c] || '—'}`).join('  ·  ')}
            </Text>
            <Text style={styles.waitingSub}>
              {stillWaitingOn > 0
                ? `Waiting for ${stillWaitingOn} more player${stillWaitingOn === 1 ? '' : 's'} to submit`
                : 'Everyone has submitted'}{' '}
              · results reveal once everyone's in.
            </Text>
          </View>
        )}

        <Pressable onPress={leaveGame} style={styles.leaveRow}>
          <Text style={styles.leaveLabel}>Leave game</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  screenDanger: { backgroundColor: '#2A0E0E' },
  scroll: { paddingHorizontal: 26, alignItems: 'center', gap: 14 },
  roundLabel: { fontFamily: fontFamily.mono500, fontSize: 11.5, letterSpacing: 1.6, color: 'rgba(255,255,255,.5)' },
  letterWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  letter: { fontFamily: fontFamily.sans800, fontSize: 76, color: colors.ink },
  timer: { fontFamily: fontFamily.mono500, fontSize: 34, color: '#fff', letterSpacing: 1 },
  timerWarn: { color: '#F5B93F' },
  timerDanger: { color: '#FF5B5B' },
  form: { width: '100%', gap: 12, marginTop: 6 },
  field: { gap: 6 },
  fieldLabel: { fontFamily: fontFamily.mono500, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,.55)' },
  input: {
    fontFamily: fontFamily.sans600,
    fontSize: 17,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,.1)',
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  error: { fontFamily: fontFamily.sans500, fontSize: 12.5, color: '#FF8A6B', textAlign: 'center' },
  submitButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 4,
  },
  submitLabel: { fontFamily: fontFamily.sans600, fontSize: 16, color: colors.ink },
  pressed: { opacity: 0.85 },
  waitingCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,.08)',
    borderRadius: 24,
    padding: 20,
    gap: 8,
    marginTop: 6,
  },
  waitingTitle: { fontFamily: fontFamily.sans600, fontSize: 16, color: '#fff', textAlign: 'center' },
  waitingBody: { fontFamily: fontFamily.sans400, fontSize: 12.5, color: 'rgba(255,255,255,.65)', textAlign: 'center' },
  waitingSub: { fontFamily: fontFamily.sans400, fontSize: 12, color: 'rgba(255,255,255,.45)', textAlign: 'center', marginTop: 4 },
  leaveRow: { paddingVertical: 14 },
  leaveLabel: { fontFamily: fontFamily.sans500, fontSize: 12.5, color: 'rgba(255,255,255,.4)' },
});
