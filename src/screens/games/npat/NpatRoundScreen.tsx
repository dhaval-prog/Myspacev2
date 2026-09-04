import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../components/Icon';
import { FriendAvatar } from '../../../components/friends/FriendAvatar';
import { TimerRing } from '../../../components/spacecards/TimerRing';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useFocusBorder } from '../../../hooks/useFocusBorder';
import { useGame } from '../../../context/GameContext';
import { noOutline } from '../../../theme/webStyles';
import { npColor, npFont, npRoundColor } from '../../../theme/npatTokens';
import type { GamePlayer } from '../../../types/games';

const CHECK_ICON = 'M5 12.5 10 17.5 19 7';

/** Seconds remaining at which the countdown starts escalating in urgency. */
const WARN_AT = 20;
const DANGER_AT = 10;
const RING_SIZE = 132;
const RING_THICKNESS = 10;

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

function AnswerRow({ label, value, onChangeText, locked, reduceMotion, delay }: { label: string; value: string; onChangeText: (t: string) => void; locked: boolean; reduceMotion?: boolean; delay: number }) {
  const entrance = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const markScale = useRef(new Animated.Value(locked ? 1 : 0)).current;
  const { borderColor: focusBorderColor, onFocus, onBlur } = useFocusBorder('rgba(255,255,255,0)', npColor.lime);

  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(entrance, { toValue: 1, duration: 450, delay, useNativeDriver: true }).start();
  }, [reduceMotion, entrance, delay]);

  useEffect(() => {
    Animated.timing(markScale, { toValue: locked ? 1 : 0, duration: reduceMotion ? 0 : 260, useNativeDriver: true }).start();
  }, [locked, reduceMotion, markScale]);

  const opacity = entrance;
  const translateY = entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  return (
    <Animated.View style={[styles.row, locked && styles.rowLocked, { opacity, transform: [{ translateY }], borderColor: focusBorderColor }]}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="Type your answer"
        placeholderTextColor={npRoundColor.onDark38}
        autoCapitalize="words"
        autoCorrect={false}
        style={[styles.rowInput, noOutline]}
      />
      <View style={styles.markSlot}>
        {locked ? (
          <Animated.View style={[styles.markOn, { transform: [{ scale: markScale }] }]}>
            <Icon path={CHECK_ICON} color={npColor.ink} size={13} strokeWidth={3} />
          </Animated.View>
        ) : (
          <View style={styles.markOff} />
        )}
      </View>
    </Animated.View>
  );
}

function PlayerChip({ player, isMe, filledCount, total, reduceMotion }: { player: GamePlayer; isMe: boolean; filledCount: number; total: number; reduceMotion?: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const doneForMe = isMe && filledCount >= total;
  const shouldPulse = isMe && !doneForMe;

  useEffect(() => {
    if (!shouldPulse || reduceMotion) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shouldPulse, reduceMotion, pulse]);

  const statusText = isMe ? `${filledCount}/${total} locked` : player.submittedRoundId ? 'Locked in' : 'Not yet';

  return (
    <View style={styles.chip}>
      <FriendAvatar userId={player.userId} name={player.name} size={28} initialsFontFamily={npFont.sans700} initialsFontSize={10.5} />
      <Text style={styles.chipName} numberOfLines={1}>
        {isMe ? 'You' : player.name}
      </Text>
      <Animated.Text style={[styles.chipStatus, isMe && styles.chipStatusMe, { opacity: isMe ? pulse : 1 }]} numberOfLines={1}>
        {statusText}
      </Animated.Text>
    </View>
  );
}

function Ticker({ text }: { text: string }) {
  return (
    <View style={styles.ticker}>
      <View style={styles.tickerDots}>
        {[0, 150, 300].map((d) => (
          <TickerDot key={d} delay={d} />
        ))}
      </View>
      <Text style={styles.tickerText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function TickerDot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 550, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.25, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, delay]);
  return <Animated.View style={[styles.tickerDot, { opacity }]} />;
}

function SubmitButton({ active, label, onPress, disabled, glowMs, reduceMotion }: { active: boolean; label: string; onPress: () => void; disabled?: boolean; glowMs: number; reduceMotion?: boolean }) {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active || reduceMotion) {
      glow.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: glowMs / 2, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: glowMs / 2, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduceMotion, glowMs, glow]);

  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.66] });

  return (
    <Animated.View style={active && { shadowColor: npColor.lime, shadowOffset: { width: 0, height: 12 }, shadowRadius: 24, shadowOpacity }}>
      <Pressable onPress={onPress} disabled={disabled} style={[styles.submit, active && styles.submitActive]} accessibilityRole="button" accessibilityLabel={label}>
        <Text style={[styles.submitLabel, active && styles.submitLabelActive]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** Live round: conic-ring countdown, one editable answer row per category (tap-to-fill locks it), a live player strip that swaps for a submission ticker in the last 20s. Submitting is final for this round — there's no edit-after-submit. */
export function NpatRoundScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
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
  const urgent = remaining <= WARN_AT;
  const danger = remaining <= DANGER_AT;
  const ringColor = danger ? npRoundColor.danger : urgent ? npRoundColor.warn : npColor.lime;

  const filledCount = categories.filter((c) => (values[c] ?? '').trim().length > 0).length;
  const allFilled = categories.length > 0 && filledCount === categories.length;

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

  const activePlayers = players.filter((p) => p.active);
  const submittedCount = activePlayers.filter((p) => p.submittedRoundId === round.id).length;
  const stillWaitingOn = Math.max(0, activePlayers.length - submittedCount);

  return (
    <LinearGradient colors={[npRoundColor.bgTop, npRoundColor.bgMid, npRoundColor.bgBottom]} locations={[0, 0.6, 1]} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 140 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.roundLabel}>
            ROUND {round.roundNumber} OF {game.roundsTotal}
          </Text>
          {!locked && urgent ? (
            <Ticker text={`${submittedCount} of ${activePlayers.length} submitted`} />
          ) : (
            <Text style={styles.liveBadge}>LIVE · {activePlayers.length} IN</Text>
          )}
        </View>

        {!locked && !urgent && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
            {activePlayers.map((p) => (
              <PlayerChip key={p.id} player={p} isMe={p.id === myPlayerId} filledCount={filledCount} total={categories.length} reduceMotion={reduceMotion} />
            ))}
          </ScrollView>
        )}

        <View style={styles.ringWrap}>
          <Text style={styles.ghostLetter} numberOfLines={1}>
            {round.letter}
          </Text>
          <TimerRing secondsLeft={remaining} limit={game.timerSeconds} urgent={danger} color={ringColor} size={RING_SIZE} thickness={RING_THICKNESS} reduceMotion={reduceMotion}>
            <View style={styles.letterCircle}>
              <Text style={styles.letter}>{round.letter}</Text>
            </View>
          </TimerRing>
          <Text style={[styles.timer, urgent && { color: ringColor }]}>{locked ? (round.status === 'playing' ? 'Locked in!' : 'Time!') : `${remaining}s`}</Text>
        </View>

        {!locked ? (
          <>
            <View style={styles.form}>
              {categories.map((category, i) => (
                <AnswerRow
                  key={category}
                  label={category}
                  value={values[category] ?? ''}
                  onChangeText={(t) => setValues((prev) => ({ ...prev, [category]: t }))}
                  locked={(values[category] ?? '').trim().length > 0}
                  reduceMotion={reduceMotion}
                  delay={i * 70}
                />
              ))}
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.bottom}>
              {urgent ? (
                <>
                  <SubmitButton active label="Submit now" onPress={handleSubmit} disabled={submitting} glowMs={1600} reduceMotion={reduceMotion} />
                  <Text style={styles.urgentHint}>Unsubmitted answers score zero</Text>
                </>
              ) : (
                <>
                  <SubmitButton
                    active={allFilled}
                    label={submitting ? 'Submitting…' : allFilled ? 'Submit Now' : 'Submit'}
                    onPress={handleSubmit}
                    disabled={!allFilled || submitting}
                    glowMs={3000}
                    reduceMotion={reduceMotion}
                  />
                  <Pressable onPress={leaveGame} style={styles.leaveRow}>
                    <Text style={styles.leaveLabel}>Leave game</Text>
                  </Pressable>
                </>
              )}
            </View>
          </>
        ) : (
          <View style={styles.waitingCard}>
            <Text style={styles.waitingTitle}>{hasSubmittedAll ? "You're locked in" : 'Round locked'}</Text>
            <Text style={styles.waitingBody}>{categories.map((c) => `${c}: ${values[c] || '—'}`).join('  ·  ')}</Text>
            <Text style={styles.waitingSub}>
              {stillWaitingOn > 0 ? `Waiting for ${stillWaitingOn} more player${stillWaitingOn === 1 ? '' : 's'} to submit` : 'Everyone has submitted'} · results reveal once everyone's in.
            </Text>
            <Pressable onPress={leaveGame} style={styles.leaveRow}>
              <Text style={styles.leaveLabel}>Leave game</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundLabel: { fontFamily: npFont.mono500, fontSize: 10, letterSpacing: 10 * 0.2, color: npRoundColor.onDark42 },
  liveBadge: { fontFamily: npFont.mono500, fontSize: 9.5, letterSpacing: 9.5 * 0.12, color: npColor.lime, backgroundColor: npRoundColor.liveBadgeBg, paddingVertical: 6, paddingHorizontal: 9, borderRadius: 999 },
  chipsScroll: { marginTop: 14, flexGrow: 0 },
  chipsRow: { gap: 7 },
  chip: { width: 70, backgroundColor: npRoundColor.chipBg, borderRadius: 16, paddingVertical: 9, paddingHorizontal: 6, alignItems: 'center', gap: 5 },
  chipName: { fontFamily: npFont.sans600, fontSize: 10, color: '#FFFFFF' },
  chipStatus: { fontFamily: npFont.mono500, fontSize: 9, letterSpacing: 9 * 0.06, color: npRoundColor.onDark40 },
  chipStatusMe: { color: npColor.lime },
  ticker: { marginTop: 13, backgroundColor: npRoundColor.chipBg, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'stretch' },
  tickerDots: { flexDirection: 'row', gap: 3 },
  tickerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: npColor.lime },
  tickerText: { fontFamily: npFont.sans600, fontSize: 12, color: npRoundColor.onDark75 },
  ringWrap: { alignItems: 'center', marginTop: 20, position: 'relative', overflow: 'hidden' },
  ghostLetter: { position: 'absolute', top: -40, fontFamily: npFont.sans800, fontSize: 150, lineHeight: 150, color: npRoundColor.ghostLetter },
  letterCircle: { width: 112, height: 112, borderRadius: 56, backgroundColor: npColor.lime, alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: npFont.sans800, fontSize: 52, color: npColor.ink, letterSpacing: -2 },
  timer: { marginTop: 11, fontFamily: npFont.sans700, fontSize: 25, letterSpacing: -0.6, color: '#FFFFFF' },
  form: { gap: 12, marginTop: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: npRoundColor.rowBg, borderRadius: 999, borderWidth: 1.5, paddingVertical: 13, paddingHorizontal: 16 },
  rowLocked: { backgroundColor: npRoundColor.rowBgLocked },
  rowLabel: { width: 52, fontFamily: npFont.mono500, fontSize: 9.5, letterSpacing: 9.5 * 0.1, color: npRoundColor.promptLabel },
  // iOS Safari auto-zooms the whole page on focus for any text input under
  // 16px and won't zoom back out on blur — 16 is the smallest size that avoids it.
  rowInput: { flex: 1, fontFamily: npFont.sans700, fontSize: 16, color: '#FFFFFF', padding: 0 },
  markSlot: { width: 22, height: 22 },
  markOn: { width: 22, height: 22, borderRadius: 11, backgroundColor: npColor.lime, alignItems: 'center', justifyContent: 'center' },
  markOff: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.6, borderColor: npRoundColor.markRing },
  error: { fontFamily: npFont.sans500, fontSize: 12.5, color: npRoundColor.danger, textAlign: 'center', marginTop: 10 },
  bottom: { marginTop: 22, gap: 4 },
  submit: { paddingVertical: 18, borderRadius: 999, alignItems: 'center', backgroundColor: npRoundColor.submitInactiveBg },
  submitActive: { backgroundColor: npColor.lime },
  submitLabel: { fontFamily: npFont.sans700, fontSize: 16, color: npRoundColor.submitInactiveText },
  submitLabelActive: { color: npColor.ink },
  urgentHint: { marginTop: 12, textAlign: 'center', fontFamily: npFont.sans500, fontSize: 11.5, color: npRoundColor.warn },
  leaveRow: { paddingVertical: 12, alignItems: 'center' },
  leaveLabel: { fontFamily: npFont.sans500, fontSize: 12.5, color: npRoundColor.onDark38 },
  waitingCard: { backgroundColor: 'rgba(255,255,255,.08)', borderRadius: 24, padding: 20, gap: 8, marginTop: 20 },
  waitingTitle: { fontFamily: npFont.sans600, fontSize: 16, color: '#fff', textAlign: 'center' },
  waitingBody: { fontFamily: npFont.sans400, fontSize: 12.5, color: npRoundColor.onDark65, textAlign: 'center' },
  waitingSub: { fontFamily: npFont.sans400, fontSize: 12, color: npRoundColor.onDark45, textAlign: 'center', marginTop: 4 },
});
