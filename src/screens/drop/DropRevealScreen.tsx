import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DropBackdrop } from '../../components/drop/DropBackdrop';
import { DropCard } from '../../components/drop/DropCard';
import { DropPress } from '../../components/drop/DropPress';
import { DropRing } from '../../components/drop/DropRing';
import { DropTopBar } from '../../components/drop/DropTopBar';
import { Kick, Serif } from '../../components/drop/DropText';
import { useDrop } from '../../context/DropContext';
import { dpColor, dpFont, dpGradient, dpSpace } from '../../theme/dropTokens';

const REACTION_EMOJIS = ['🥹', '😂', '❤️', '👀'] as const;

interface DropRevealScreenProps {
  onBack: () => void;
}

/** The reveal — wavelength score, then each prompt compared side by side, with a tap-once reaction row. */
export function DropRevealScreen({ onBack }: DropRevealScreenProps) {
  const insets = useSafeAreaInsets();
  const { todayPrompts, myAnswers, partnerAnswers, todayState, pair, reactionsByPrompt, react } = useDrop();

  if (!pair) return null;
  const wavePct = todayState?.wavePct ?? 0;

  return (
    <LinearGradient colors={dpGradient.dawn.colors} locations={dpGradient.dawn.locations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
      <DropBackdrop />
      <DropTopBar title="today's reveal" onBack={onBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 52 + 24, paddingBottom: insets.bottom + 60 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.ringWrap}>
          <DropRing pct={wavePct} size={168}>
            <Text style={styles.ringValue}>{wavePct}%</Text>
            <Kick>wavelength</Kick>
          </DropRing>
        </View>
        <Text style={styles.ringCaption}>
          how often your hunch about {pair.other.name} matched what they actually picked, and theirs about you.
        </Text>
        {todayPrompts.map((prompt, idx) => {
          const mine = myAnswers[prompt.id];
          const theirs = partnerAnswers[prompt.id];
          const reactions = reactionsByPrompt[prompt.id] ?? { mine: null, partner: null };
          if (!mine || !theirs) return null;
          const hunchHitMine = mine.hunch === theirs.pick;
          const hunchHitTheirs = theirs.hunch === mine.pick;

          return (
            <DropCard key={prompt.id} style={styles.promptCard}>
              <Kick>prompt {idx + 1}</Kick>
              <Text style={styles.question}>
                {prompt.emoji ? `${prompt.emoji} ` : ''}
                {prompt.question}
              </Text>

              <View style={styles.compareRow}>
                <View style={styles.compareCol}>
                  <Text style={styles.compareLabel}>You picked</Text>
                  <Text style={styles.compareValueMe}>{prompt.options[mine.pick]}</Text>
                  <Text style={styles.compareLabel}>Your hunch for them</Text>
                  <Text style={[styles.compareValueMe, hunchHitMine && styles.hit]}>{prompt.options[mine.hunch]} {hunchHitMine ? '✓' : ''}</Text>
                </View>
                <View style={styles.compareCol}>
                  <Text style={styles.compareLabel}>{pair.other.name} picked</Text>
                  <Text style={styles.compareValueThem}>{prompt.options[theirs.pick]}</Text>
                  <Text style={styles.compareLabel}>Their hunch for you</Text>
                  <Text style={[styles.compareValueThem, hunchHitTheirs && styles.hit]}>{prompt.options[theirs.hunch]} {hunchHitTheirs ? '✓' : ''}</Text>
                </View>
              </View>

              <View style={styles.reactionRow}>
                {REACTION_EMOJIS.map((emoji) => (
                  <DropPress key={emoji} onPress={() => react(prompt.id, emoji)} accessibilityLabel={`React ${emoji}`}>
                    <View style={[styles.reactionPill, reactions.mine === emoji && styles.reactionPillSelected]}>
                      <Text style={styles.reactionEmoji}>{emoji}</Text>
                    </View>
                  </DropPress>
                ))}
                {reactions.partner && (
                  <View style={styles.partnerReaction}>
                    <Text style={styles.partnerReactionEmoji}>{reactions.partner}</Text>
                  </View>
                )}
              </View>
            </DropCard>
          );
        })}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: dpSpace.gutter, alignItems: 'center' },
  ringWrap: { marginTop: 8, marginBottom: 12 },
  ringValue: { fontFamily: dpFont.disp, fontSize: 40, color: dpColor.ink },
  ringCaption: { fontFamily: dpFont.ui400, fontSize: 12.5, color: dpColor.inkSoft, textAlign: 'center', lineHeight: 12.5 * 1.5, marginBottom: 8, maxWidth: 280 },
  caughtUpNote: { fontFamily: dpFont.ui400, fontSize: 11.5, color: dpColor.inkMute, fontStyle: 'italic', marginBottom: 8 },
  promptCard: { padding: 16, marginBottom: 16, width: '100%' },
  question: { fontFamily: dpFont.ui700, fontSize: 15.5, color: dpColor.ink, marginTop: 6, marginBottom: 14, lineHeight: 15.5 * 1.35 },
  compareRow: { flexDirection: 'row', gap: 14 },
  compareCol: { flex: 1, gap: 4 },
  compareLabel: { fontFamily: dpFont.mono, fontSize: 8.5, letterSpacing: 1, textTransform: 'uppercase', color: dpColor.inkMute, marginTop: 8 },
  compareValueMe: { fontFamily: dpFont.ui600, fontSize: 13, color: dpColor.p1Deep },
  compareValueThem: { fontFamily: dpFont.ui600, fontSize: 13, color: dpColor.p2Deep },
  hit: { color: dpColor.matchDeep },
  reactionRow: { flexDirection: 'row', gap: 8, marginTop: 16, alignItems: 'center' },
  reactionPill: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: dpColor.sunken, borderWidth: 1.5, borderColor: 'transparent' },
  reactionPillSelected: { borderColor: dpColor.p1, backgroundColor: 'rgba(255,142,122,0.14)' },
  reactionEmoji: { fontSize: 17 },
  partnerReaction: { marginLeft: 4, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(157,149,245,0.18)' },
  partnerReactionEmoji: { fontSize: 15 },
});
