import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DropCard } from './DropCard';
import { DropPress } from './DropPress';
import { DropBtn } from './DropBtn';
import { Kick, Serif } from './DropText';
import { useDrop } from '../../context/DropContext';
import type { RepairVerdict } from '../../types/drop';
import { dpColor, dpFont } from '../../theme/dropTokens';

const VERDICTS: { verdict: RepairVerdict; emoji: string; label: string }[] = [
  { verdict: 'yes', emoji: '💛', label: 'yes' },
  { verdict: 'getting_there', emoji: '🌤️', label: 'getting there' },
  { verdict: 'still_tender', emoji: '🌫️', label: 'still tender' },
];

function outcomeFor(mine: RepairVerdict, theirs: RepairVerdict): 'repair' | 'getting_there' | 'tender' {
  if (mine === 'yes' && theirs === 'yes') return 'repair';
  if (mine === 'still_tender' || theirs === 'still_tender') return 'tender';
  return 'getting_there';
}

interface RepairCheckinCardProps {
  partnerName: string;
  onTalkAgain: () => void;
}

/** Day-after follow-up: "did you two find your way back?" — answer privately, reveal together once both have. */
export function RepairCheckinCard({ partnerName, onTalkAgain }: RepairCheckinCardProps) {
  const { repairCheckin, submitRepairVerdict } = useDrop();
  const [revealSeenIds, setRevealSeenIds] = useState<string[]>([]);
  const [reflectionSavedIds, setReflectionSavedIds] = useState<string[]>([]);
  const [reflectionText, setReflectionText] = useState('');
  const [reflectionSaving, setReflectionSaving] = useState(false);
  const { addPrivateLearning } = useDrop();

  useEffect(() => {
    AsyncStorage.getItem('drop:repair_reveal_seen').then((v) => setRevealSeenIds(v ? JSON.parse(v) : []));
    AsyncStorage.getItem('drop:repair_reflection_saved').then((v) => setReflectionSavedIds(v ? JSON.parse(v) : []));
  }, []);

  if (!repairCheckin.exists || !repairCheckin.id) return null;
  const id = repairCheckin.id;

  const markRevealSeen = async () => {
    const next = [...revealSeenIds, id];
    setRevealSeenIds(next);
    await AsyncStorage.setItem('drop:repair_reveal_seen', JSON.stringify(next));
  };

  const saveReflection = async () => {
    if (!reflectionText.trim()) return;
    setReflectionSaving(true);
    await addPrivateLearning(reflectionText.trim());
    const next = [...reflectionSavedIds, id];
    setReflectionSavedIds(next);
    await AsyncStorage.setItem('drop:repair_reflection_saved', JSON.stringify(next));
    setReflectionSaving(false);
  };

  if (repairCheckin.state === 'open') {
    if (repairCheckin.iAnswered) {
      return (
        <DropCard style={styles.card}>
          <Kick>checking in</Kick>
          <Text style={styles.waiting}>your answer is in · you'll both see them when {partnerName} answers</Text>
        </DropCard>
      );
    }
    return (
      <DropCard style={styles.card}>
        <Kick>checking in</Kick>
        <Serif s={20} style={{ marginTop: 6, marginBottom: 4 }}>
          did you two find your way back?
        </Serif>
        <Text style={styles.sub}>answer privately — you see each other's the moment you both have.</Text>
        <View style={styles.verdictRow}>
          {VERDICTS.map((v) => (
            <DropPress key={v.verdict} onPress={() => submitRepairVerdict(v.verdict)} style={styles.verdictPill}>
              <Text style={styles.verdictEmoji}>{v.emoji}</Text>
              <Text style={styles.verdictLabel}>{v.label}</Text>
            </DropPress>
          ))}
        </View>
      </DropCard>
    );
  }

  if (repairCheckin.state === 'revealed' && !revealSeenIds.includes(id) && repairCheckin.myVerdict && repairCheckin.theirVerdict) {
    const outcome = outcomeFor(repairCheckin.myVerdict, repairCheckin.theirVerdict);
    const line =
      outcome === 'repair'
        ? "that's a repair. most couples never learn to do that."
        : outcome === 'getting_there'
          ? 'finding your way back, together. that counts.'
          : 'still tender is honest. no rush, the way back is still there.';
    return (
      <DropCard style={styles.card}>
        <Kick>you both answered</Kick>
        <Text style={styles.revealLine}>{outcome === 'repair' ? '✨ ' : ''}{line}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {outcome === 'tender' && (
            <DropPress
              onPress={() => {
                markRevealSeen();
                onTalkAgain();
              }}
              style={styles.smallBtnDeep}
            >
              <Text style={styles.smallBtnDeepLabel}>talk it through again</Text>
            </DropPress>
          )}
          <DropPress onPress={markRevealSeen} style={styles.smallBtnSoft}>
            <Text style={styles.smallBtnSoftLabel}>close</Text>
          </DropPress>
        </View>
      </DropCard>
    );
  }

  if (repairCheckin.state === 'reflection' && repairCheckin.reflectionMine && !reflectionSavedIds.includes(id)) {
    return (
      <DropCard style={styles.card}>
        <Kick>just for you</Kick>
        <Serif s={20} style={{ marginTop: 6, marginBottom: 4 }}>
          what did this one teach you?
        </Serif>
        <Text style={styles.sub}>saved privately to your Love Map — never shown to your partner.</Text>
        <TextInput
          value={reflectionText}
          onChangeText={setReflectionText}
          placeholder="say it however it comes…"
          placeholderTextColor={dpColor.inkMute}
          multiline
          style={styles.input}
        />
        <DropBtn kind="soft" onPress={saveReflection} disabled={reflectionSaving || !reflectionText.trim()}>
          {reflectionSaving ? 'saving…' : 'keep it'}
        </DropBtn>
      </DropCard>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 16 },
  sub: { fontFamily: dpFont.ui400, fontSize: 12.5, color: dpColor.inkSoft, lineHeight: 12.5 * 1.4 },
  waiting: { fontFamily: dpFont.ui400, fontSize: 13, color: dpColor.inkSoft, marginTop: 6 },
  verdictRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  verdictPill: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: 16, backgroundColor: dpColor.sunken },
  verdictEmoji: { fontSize: 20 },
  verdictLabel: { fontFamily: dpFont.ui600, fontSize: 11, color: dpColor.ink },
  revealLine: { fontFamily: dpFont.ui500, fontSize: 14, color: dpColor.ink, marginTop: 8, lineHeight: 14 * 1.5 },
  smallBtnSoft: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: dpColor.sunken },
  smallBtnSoftLabel: { fontFamily: dpFont.ui600, fontSize: 12.5, color: dpColor.ink },
  smallBtnDeep: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: dpColor.p2Deep },
  smallBtnDeepLabel: { fontFamily: dpFont.ui600, fontSize: 12.5, color: '#fff' },
  input: {
    marginTop: 10,
    marginBottom: 10,
    minHeight: 70,
    borderRadius: 14,
    backgroundColor: dpColor.sunken,
    padding: 12,
    fontFamily: dpFont.ui400,
    fontSize: 14,
    color: dpColor.ink,
    textAlignVertical: 'top',
  },
});
