import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '../../../theme';
import { Icon } from '../../../components/Icon';
import { BottomNav } from '../../../components/BottomNav';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useAuth } from '../../../context/AuthContext';
import { useGame } from '../../../context/GameContext';
import type { AnswerValidationStatus } from '../../../types/games';

const BACK_ICON = 'M15 5l-7 7 7 7';

const STATUS_STYLE: Record<AnswerValidationStatus, { bg: string; fg: string; label: string }> = {
  valid: { bg: '#E6F6EC', fg: '#1F9254', label: 'Valid' },
  invalid: { bg: 'rgba(211,50,67,0.12)', fg: '#D33243', label: 'Invalid' },
  review: { bg: '#FFF3D6', fg: '#B98200', label: 'Under review' },
  pending: { bg: 'rgba(22,33,12,0.08)', fg: colors.ink50, label: 'Pending' },
};

function reasonFor(status: AnswerValidationStatus, isDuplicate: boolean, category: string, letter: string): string {
  if (status === 'invalid') return `Didn't check out as a ${category.toLowerCase()} starting with "${letter}".`;
  if (status === 'review') return "Close call — a host or the app couldn't confirm this one with full confidence.";
  if (isDuplicate) return 'Someone else in the game gave the same answer, so it scored as a duplicate.';
  return 'Unique and valid — full points.';
}

interface NpatResultsScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
}

export function NpatResultsScreen({ onHome, onOpenExpenses, onOpenSplit }: NpatResultsScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const { game, round, players, answers, myPlayerId, startRound, leaveGame } = useGame();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!game || !round) return null;

  const isHost = !!user && user.id === game.hostId;
  const active = players.filter((p) => p.active).sort((a, b) => b.totalScore - a.totalScore);
  const roundsLeft = game.roundsTotal - game.currentRound;

  const handleNext = async () => {
    setStarting(true);
    setError(null);
    const { error: err } = await startRound();
    setStarting(false);
    if (err) setError(err);
  };

  const answersByPlayer = (playerId: string) => answers.filter((a) => a.playerId === playerId);

  return (
    <LinearGradient
      colors={colors.friendsCanvas as [string, string, ...string[]]}
      locations={colors.friendsCanvasStops as [number, number, ...number[]]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
      <ScrollView style={styles.scrollFlex} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Round {round.roundNumber} results</Text>
          <Text style={styles.sub}>The letter was "{round.letter}"</Text>
        </View>

        <Text style={styles.eyebrow}>LEADERBOARD</Text>
        <View style={styles.list}>
          {active.map((p, i) => (
            <View key={p.id} style={[styles.rankRow, p.id === myPlayerId && styles.rankRowMe]}>
              <Text style={styles.rankNumber}>{i + 1}</Text>
              <Text style={styles.rankName}>
                {p.name}
                {p.id === myPlayerId ? ' (you)' : ''}
              </Text>
              <Text style={styles.rankScore}>{p.totalScore}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.eyebrow}>YOUR ANSWERS</Text>
        <View style={styles.list}>
          {answersByPlayer(myPlayerId ?? '').map((a) => {
            const s = STATUS_STYLE[a.validationStatus];
            const isOpen = expanded === a.id;
            return (
              <Pressable key={a.id} onPress={() => setExpanded(isOpen ? null : a.id)} style={styles.answerRow}>
                <View style={styles.answerHead}>
                  <Text style={styles.answerCategory}>{a.category}</Text>
                  <Text style={styles.answerValue}>{a.answer || '—'}</Text>
                  <View style={[styles.badge, { backgroundColor: s.bg }]}>
                    <Text style={[styles.badgeLabel, { color: s.fg }]}>{a.validationStatus === 'valid' && a.isDuplicate ? '+5' : a.validationStatus === 'valid' ? '+10' : '+0'}</Text>
                  </View>
                </View>
                {isOpen && <Text style={styles.answerReason}>{reasonFor(a.validationStatus, a.isDuplicate, a.category, round.letter)}</Text>}
              </Pressable>
            );
          })}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {isHost && roundsLeft > 0 && (
          <Pressable onPress={handleNext} disabled={starting} style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}>
            <Text style={styles.ctaLabel}>{starting ? 'Starting…' : `Start round ${game.currentRound + 1}`}</Text>
          </Pressable>
        )}
        {!isHost && roundsLeft > 0 && <Text style={styles.waitingText}>Waiting for the host to start the next round…</Text>}
        {roundsLeft <= 0 && <Text style={styles.waitingText}>Final round complete — tallying the game…</Text>}
      </ScrollView>

      <View style={styles.pinned}>
        <Pressable
          onPress={() => {
            leaveGame();
            onHome();
          }}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
        >
          <Icon path={BACK_ICON} color={colors.textPrimary} size={18} strokeWidth={2} />
        </Pressable>
      </View>

      <BottomNav
        activeId="games"
        onSelect={(id) => {
          if (id === 'home') onHome();
          if (id === 'expenses') onOpenExpenses();
          if (id === 'split') onOpenSplit();
        }}
        bottomInset={insets.bottom}
        reduceMotion={reduceMotion}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollFlex: { flex: 1 },
  scroll: { paddingHorizontal: 26, paddingBottom: spacing.lg, gap: 14 },
  pinned: { paddingHorizontal: 26, paddingTop: spacing.ms, paddingBottom: spacing.ms },
  headerRow: { gap: 2 },
  title: { fontFamily: fontFamily.sans700, fontSize: 26, lineHeight: 28, letterSpacing: -0.7, color: colors.textPrimary },
  sub: { fontFamily: fontFamily.sans400, fontSize: 13.5, color: colors.textSecondary },
  eyebrow: {
    fontFamily: fontFamily.sans600,
    fontSize: 11.5,
    letterSpacing: 1.495,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginTop: 4,
  },
  list: { gap: 8 },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,.7)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rankRowMe: { backgroundColor: 'rgba(255,255,255,.95)' },
  rankNumber: { fontFamily: fontFamily.mono500, fontSize: 13, color: colors.ink50, width: 18 },
  rankName: { flex: 1, fontFamily: fontFamily.sans600, fontSize: 14.5, color: colors.textPrimary },
  rankScore: { fontFamily: fontFamily.mono500, fontSize: 15, color: colors.textPrimary },
  answerRow: { backgroundColor: 'rgba(255,255,255,.7)', borderRadius: 18, padding: 14, gap: 6 },
  answerHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  answerCategory: { fontFamily: fontFamily.mono500, fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.textFaint, width: 60 },
  answerValue: { flex: 1, fontFamily: fontFamily.sans600, fontSize: 15, color: colors.textPrimary },
  badge: { borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 },
  badgeLabel: { fontFamily: fontFamily.mono500, fontSize: 12 },
  answerReason: { fontFamily: fontFamily.sans400, fontSize: 12.5, color: colors.textSecondary },
  error: { fontFamily: fontFamily.sans500, fontSize: 12.5, color: colors.danger, textAlign: 'center' },
  ctaButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#7AA82C',
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 4,
  },
  ctaLabel: { fontFamily: fontFamily.sans600, fontSize: 16, color: colors.ink },
  pressed: { opacity: 0.85 },
  waitingText: { fontFamily: fontFamily.sans400, fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6 },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 1,
  },
});
