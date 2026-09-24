import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DropBackdrop } from '../../components/drop/DropBackdrop';
import { DropCard } from '../../components/drop/DropCard';
import { DropPress } from '../../components/drop/DropPress';
import { DropBtn } from '../../components/drop/DropBtn';
import { DropTopBar } from '../../components/drop/DropTopBar';
import { Kick } from '../../components/drop/DropText';
import { useDrop } from '../../context/DropContext';
import { dpColor, dpFont, dpGradient, dpSpace } from '../../theme/dropTokens';

interface DropAnswerScreenProps {
  onBack: () => void;
  onSubmitted: (wasRevealed: boolean) => void;
}

/** The 3-prompt answer + hunch entry — private until both sides are in, per the reveal-gate mechanic. */
export function DropAnswerScreen({ onBack, onSubmitted }: DropAnswerScreenProps) {
  const insets = useSafeAreaInsets();
  const { todayPrompts, submitAnswers, pair } = useDrop();
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [hunches, setHunches] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const allAnswered = useMemo(
    () => todayPrompts.length > 0 && todayPrompts.every((p) => picks[p.id] !== undefined && hunches[p.id] !== undefined),
    [todayPrompts, picks, hunches],
  );

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const answers = todayPrompts.map((p) => ({ promptId: p.id, pick: picks[p.id], hunch: hunches[p.id] }));
      const { error, wavePct } = await submitAnswers(answers);
      if (!error) onSubmitted(typeof wavePct === 'number');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={dpGradient.dawn.colors} locations={dpGradient.dawn.locations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
      <DropBackdrop />
      <DropTopBar title="today's drop" onBack={onBack} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 52 + 24, paddingBottom: insets.bottom + 140 }]}
        showsVerticalScrollIndicator={false}
      >
        {todayPrompts.map((prompt, idx) => (
          <DropCard key={prompt.id} style={styles.promptCard}>
            <Kick>prompt {idx + 1} of {todayPrompts.length}</Kick>
            <Text style={styles.question}>
              {prompt.emoji ? `${prompt.emoji} ` : ''}
              {prompt.question}
            </Text>

            <Text style={styles.groupLabel}>You'd pick</Text>
            <View style={styles.optionsWrap}>
              {prompt.options.map((opt, i) => (
                <DropPress key={i} onPress={() => setPicks((prev) => ({ ...prev, [prompt.id]: i }))}>
                  <View style={[styles.option, picks[prompt.id] === i && styles.optionSelectedMe]}>
                    <Text style={[styles.optionText, picks[prompt.id] === i && styles.optionTextSelected]}>{opt}</Text>
                  </View>
                </DropPress>
              ))}
            </View>

            <Text style={styles.groupLabel}>Your hunch: what would {pair?.other.name} pick?</Text>
            <View style={styles.optionsWrap}>
              {prompt.options.map((opt, i) => (
                <DropPress key={i} onPress={() => setHunches((prev) => ({ ...prev, [prompt.id]: i }))}>
                  <View style={[styles.option, hunches[prompt.id] === i && styles.optionSelectedThem]}>
                    <Text style={[styles.optionText, hunches[prompt.id] === i && styles.optionTextSelected]}>{opt}</Text>
                  </View>
                </DropPress>
              ))}
            </View>
          </DropCard>
        ))}

        <DropBtn kind="us" onPress={handleSubmit} disabled={!allAnswered || submitting} style={{ marginTop: 8 }}>
          {submitting ? 'Sending…' : 'Send my side'}
        </DropBtn>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: dpSpace.gutter },
  promptCard: { padding: 16, marginBottom: 16 },
  question: { fontFamily: dpFont.ui700, fontSize: 17, color: dpColor.ink, marginTop: 8, marginBottom: 14, lineHeight: 17 * 1.35 },
  groupLabel: { fontFamily: dpFont.mono, fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase', color: dpColor.inkMute, marginBottom: 8 },
  optionsWrap: { gap: 8, marginBottom: 16 },
  option: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 14, backgroundColor: dpColor.sunken },
  optionSelectedMe: { backgroundColor: 'rgba(255,142,122,0.16)', borderWidth: 1.5, borderColor: dpColor.p1Deep },
  optionSelectedThem: { backgroundColor: 'rgba(157,149,245,0.18)', borderWidth: 1.5, borderColor: dpColor.p2Deep },
  optionText: { fontFamily: dpFont.ui500, fontSize: 14, color: dpColor.ink },
  optionTextSelected: { fontFamily: dpFont.ui700 },
});
