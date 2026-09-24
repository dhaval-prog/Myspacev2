import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DropCard } from './DropCard';
import { DropPress } from './DropPress';
import { Kick } from './DropText';
import { useDrop } from '../../context/DropContext';
import type { Mood } from '../../types/drop';
import { dpColor, dpFont } from '../../theme/dropTokens';

const MOODS: { mood: Mood; emoji: string }[] = [
  { mood: 'golden', emoji: '🌞' },
  { mood: 'good', emoji: '🙂' },
  { mood: 'off', emoji: '🌫️' },
  { mood: 'heavy', emoji: '🌧️' },
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface MoodCheckCardProps {
  playedToday: boolean;
  onTalkItThrough: () => void;
}

/** Once-a-day, 4-emoji "how are we today?" — a bright pick gets a transient ack, a rough pick quietly expands into an offer to open Refocus. */
export function MoodCheckCard({ playedToday, onTalkItThrough }: MoodCheckCardProps) {
  const { mood, submitMoodCheck } = useDrop();
  const [pickedThisSession, setPickedThisSession] = useState(false);
  const [offerDismissedToday, setOfferDismissedToday] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('drop:mood_offer_dismissed_on').then((v) => setOfferDismissedToday(v === todayKey()));
  }, []);

  const suppressOfferToday = async () => {
    await AsyncStorage.setItem('drop:mood_offer_dismissed_on', todayKey());
    setOfferDismissedToday(true);
  };

  const isRough = (m: Mood) => m === 'off' || m === 'heavy';

  const kind: 'hidden' | 'greeting' | 'ack' | 'offer' = (() => {
    if (mood.myMood === null) return playedToday ? 'hidden' : 'greeting';
    if (isRough(mood.myMood)) return playedToday || offerDismissedToday ? 'hidden' : 'offer';
    return pickedThisSession ? 'ack' : 'hidden';
  })();

  if (kind === 'hidden') return null;

  const handlePick = async (m: Mood) => {
    setPickedThisSession(true);
    await submitMoodCheck(m);
  };

  return (
    <DropCard style={styles.card}>
      <Kick>how are we today?</Kick>
      <View style={styles.row}>
        {MOODS.map(({ mood: m, emoji }) => (
          <DropPress key={m} onPress={() => handlePick(m)} accessibilityRole="radio" accessibilityState={{ selected: mood.myMood === m }}>
            <View style={[styles.pill, mood.myMood === m && styles.pillSelected]}>
              <Text style={styles.emoji}>{emoji}</Text>
            </View>
          </DropPress>
        ))}
      </View>
      {kind === 'ack' && <Text style={styles.ack}>noted ✓</Text>}
      {kind === 'offer' && (
        <View style={styles.offerRow}>
          <Text style={styles.offerLine}>want to talk it through first?</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <DropPress
              onPress={async () => {
                await suppressOfferToday();
                onTalkItThrough();
              }}
              style={styles.offerBtn}
            >
              <Text style={styles.offerBtnLabel}>let's talk</Text>
            </DropPress>
            <DropPress onPress={suppressOfferToday} style={styles.offerBtnGhost}>
              <Text style={styles.offerBtnGhostLabel}>not now</Text>
            </DropPress>
          </View>
        </View>
      )}
    </DropCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  pill: { width: 48, height: 48, borderRadius: 24, backgroundColor: dpColor.sunken, alignItems: 'center', justifyContent: 'center' },
  pillSelected: { backgroundColor: dpColor.usSoft, borderWidth: 2, borderColor: dpColor.p2Deep },
  emoji: { fontSize: 22 },
  ack: { fontFamily: dpFont.ui600, fontSize: 12.5, color: dpColor.matchDeep, marginTop: 10 },
  offerRow: { marginTop: 12, gap: 10 },
  offerLine: { fontFamily: dpFont.ui400, fontSize: 13.5, color: dpColor.inkSoft },
  offerBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: dpColor.p2Deep },
  offerBtnLabel: { fontFamily: dpFont.ui600, fontSize: 12.5, color: '#fff' },
  offerBtnGhost: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: dpColor.sunken },
  offerBtnGhostLabel: { fontFamily: dpFont.ui600, fontSize: 12.5, color: dpColor.ink },
});
