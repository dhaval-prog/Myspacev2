import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { BottomNav } from '../../components/BottomNav';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useGameStats } from '../../context/GameStatsContext';
import type { CircleMember, GameBreakdownEntry } from '../../types/gameStats';
import { FriendCircle } from './components/FriendCircle';
import { LeadershipCircle, LeadershipCirclePreview } from './components/LeadershipCircle';
import { GameBreakdownChart, GameBreakdownPreview } from './components/GameBreakdownChart';
import { PlayerStatsModal, GameDetailModal, SectionModal, resultGlyph, dayLabel } from './components/GamesDashboardModals';
import { gameTypeLabel } from '../../types/gameStats';

const BACK_ICON = 'M15 5l-7 7 7 7';

interface GamesDashboardScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  onOpenFriends: () => void;
  onOpenNpat: () => void;
  onOpenCards: () => void;
}

/**
 * The Games landing screen — a social gaming hub, not a specific game.
 * Friend circle, global Game Points, Leadership Circle ranking (friends only),
 * and a per-game breakdown, all sourced from GameStatsContext (server-computed).
 */
export function GamesDashboardScreen({ onHome, onOpenExpenses, onOpenSplit, onOpenFriends, onOpenNpat, onOpenCards }: GamesDashboardScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { loading, circle, leaderboard, myEntry, myRankDelta, breakdown, recentActivity, breakdownFor, recentActivityFor } = useGameStats();

  const [selectedMember, setSelectedMember] = useState<CircleMember | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<GameBreakdownEntry | null>(null);
  const [showLeadership, setShowLeadership] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const self = circle.find((c) => c.isSelf) ?? null;
  const friends = circle.filter((c) => !c.isSelf);
  const anyonePlayed = circle.some((c) => c.stats.gamesPlayed > 0);
  const myTotal = self?.stats.totalPoints ?? 0;

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
          <Text style={styles.title}>Games</Text>
          <Text style={styles.sub}>Your gaming circle</Text>
        </View>

        {/* Your Circle — one line */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Circle</Text>
          {!loading && friends.length === 0 ? (
            <View style={styles.emptyPanel}>
              <Text style={styles.emptyTitle}>Your circle is empty.</Text>
              <Text style={styles.emptyBody}>Invite some friends and start playing together.</Text>
              <Pressable style={styles.primaryBtn} onPress={onOpenFriends} accessibilityRole="button">
                <Text style={styles.primaryBtnLabel}>Invite Friends</Text>
              </Pressable>
            </View>
          ) : self ? (
            <FriendCircle self={self} friends={friends} onSelectMember={setSelectedMember} />
          ) : null}
        </View>

        {/* Your Score / Leadership Circle / Points Breakdown — one line */}
        {self && friends.length > 0 && (
          <View style={styles.tripleRow}>
            <View style={styles.miniCard}>
              <Text style={styles.miniCardTitle}>Your Score</Text>
              <Text style={styles.scoreValue}>{myTotal}</Text>
              <Text style={styles.scoreSub}>PTS</Text>
              {myEntry && (
                <View style={styles.rankPill}>
                  <Text style={styles.rankPillText}>#{myEntry.rank}</Text>
                </View>
              )}
              {myRankDelta !== null && myRankDelta !== 0 && (
                <Text style={[styles.rankDelta, myRankDelta < 0 && styles.rankDeltaDown]} numberOfLines={1}>
                  {myRankDelta > 0 ? `▲${myRankDelta}` : `▼${Math.abs(myRankDelta)}`}
                </Text>
              )}
            </View>

            <Pressable style={styles.miniCard} onPress={() => setShowLeadership(true)} accessibilityRole="button" accessibilityLabel="View Leadership Circle">
              <Text style={styles.miniCardTitle}>Leadership Circle</Text>
              {anyonePlayed ? (
                <LeadershipCirclePreview leaderboard={leaderboard} />
              ) : (
                <Text style={styles.miniEmptyText}>Not started</Text>
              )}
            </Pressable>

            <Pressable style={styles.miniCard} onPress={() => setShowBreakdown(true)} accessibilityRole="button" accessibilityLabel="View Points Breakdown">
              <Text style={styles.miniCardTitle}>Points Breakdown</Text>
              {breakdown.length > 0 ? (
                <GameBreakdownPreview entries={breakdown} total={myTotal} />
              ) : (
                <Text style={styles.miniEmptyText}>No data yet</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Game Activity</Text>
            <View style={styles.activityList}>
              {recentActivity.slice(0, 6).map((tx) => (
                <View key={tx.id} style={styles.activityRow}>
                  <Text style={styles.activityDay}>{dayLabel(tx.createdAt)}</Text>
                  <Text style={styles.activityGlyph}>{resultGlyph(tx.result)}</Text>
                  <Text style={styles.activityGame} numberOfLines={1}>{gameTypeLabel(tx.gameType)}</Text>
                  <Text style={[styles.activityChange, tx.pointsChange < 0 && styles.negative]}>
                    {tx.pointsChange > 0 ? `+${tx.pointsChange}` : tx.pointsChange}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Play a Game */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Play a Game</Text>
          <Pressable style={[styles.playBtn, { backgroundColor: colors.ink }]} onPress={onOpenNpat} accessibilityRole="button">
            <Text style={styles.playEmoji}>🎯</Text>
            <Text style={styles.playLabel}>Name, Place, Animal, Thing</Text>
            <Icon path="M9 6l6 6-6 6" color="#fff" size={14} strokeWidth={2.2} />
          </Pressable>
          <Pressable style={[styles.playBtn, { backgroundColor: '#2C1B4D' }]} onPress={onOpenCards} accessibilityRole="button">
            <Text style={styles.playEmoji}>🃏</Text>
            <Text style={styles.playLabel}>Space Cards</Text>
            <Icon path="M9 6l6 6-6 6" color="#fff" size={14} strokeWidth={2.2} />
          </Pressable>
          <Text style={styles.moreGames}>More games coming soon</Text>
        </View>
      </ScrollView>

      <View style={styles.pinned}>
        <Pressable onPress={onHome} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back to Home">
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

      <PlayerStatsModal
        member={selectedMember}
        breakdown={selectedMember ? breakdownFor(selectedMember.userId) : []}
        recentActivity={selectedMember ? recentActivityFor(selectedMember.userId, 8) : []}
        onClose={() => setSelectedMember(null)}
      />
      <GameDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />

      <SectionModal visible={showLeadership} title="Leadership Circle" onClose={() => setShowLeadership(false)}>
        {!anyonePlayed ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>Let's get playing</Text>
            <Text style={styles.emptyBody}>Your friends are here. Start your first game and build your Game Points.</Text>
          </View>
        ) : (
          <LeadershipCircle
            leaderboard={leaderboard}
            onSelectMember={(m) => {
              setShowLeadership(false);
              setSelectedMember(m);
            }}
          />
        )}
      </SectionModal>

      <SectionModal visible={showBreakdown} title="Points Breakdown" onClose={() => setShowBreakdown(false)}>
        <GameBreakdownChart
          entries={breakdown}
          total={myTotal}
          onSelectEntry={(e) => {
            setShowBreakdown(false);
            setSelectedEntry(e);
          }}
        />
      </SectionModal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollFlex: { flex: 1 },
  scroll: { paddingHorizontal: 22, paddingBottom: spacing.lg, gap: 16 },
  pinned: { paddingHorizontal: 26, paddingTop: spacing.ms, paddingBottom: spacing.ms },
  headerRow: { gap: 2, paddingHorizontal: 4 },
  title: { fontFamily: fontFamily.sans700, fontSize: 30, lineHeight: 31.5, letterSpacing: -0.9, color: colors.textPrimary },
  sub: { fontFamily: fontFamily.sans400, fontSize: 13.5, color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface86,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 2,
  },
  cardTitle: { fontFamily: fontFamily.sans700, fontSize: 15.5, color: colors.textPrimary },
  emptyPanel: { alignItems: 'center', gap: 8, paddingVertical: spacing.md },
  emptyTitle: { fontFamily: fontFamily.sans600, fontSize: 15, color: colors.textPrimary },
  emptyBody: { fontFamily: fontFamily.sans400, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  primaryBtn: { marginTop: 4, paddingVertical: 10, paddingHorizontal: 22, borderRadius: radius.pill, backgroundColor: colors.lime },
  primaryBtnLabel: { fontFamily: fontFamily.sans700, fontSize: 13.5, color: colors.ink },
  tripleRow: { flexDirection: 'row', gap: 10 },
  miniCard: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    backgroundColor: colors.surface86,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: 6,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 2,
  },
  miniCardTitle: { fontFamily: fontFamily.sans700, fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  miniEmptyText: { fontFamily: fontFamily.sans400, fontSize: 11.5, color: colors.textFaint, textAlign: 'center', paddingVertical: 12 },
  scoreValue: { fontFamily: fontFamily.sans800, fontSize: 30, color: colors.textPrimary, lineHeight: 32 },
  scoreSub: { fontFamily: fontFamily.sans600, fontSize: 10, color: colors.textMuted, letterSpacing: 1 },
  rankPill: { marginTop: 2, paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.lime },
  rankPillText: { fontFamily: fontFamily.sans700, fontSize: 11, color: colors.ink },
  rankDelta: { fontFamily: fontFamily.sans600, fontSize: 11, color: '#1F9254' },
  rankDeltaDown: { color: colors.danger },
  activityList: { gap: 2 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  activityDay: { width: 56, fontFamily: fontFamily.sans400, fontSize: 11.5, color: colors.textFaint },
  activityGlyph: { fontSize: 14 },
  activityGame: { flex: 1, fontFamily: fontFamily.sans600, fontSize: 13.5, color: colors.textPrimary },
  activityChange: { fontFamily: fontFamily.sans700, fontSize: 13.5, color: colors.textPrimary },
  negative: { color: colors.danger },
  playBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 16 },
  playEmoji: { fontSize: 20 },
  playLabel: { flex: 1, fontFamily: fontFamily.sans600, fontSize: 14.5, color: '#fff' },
  moreGames: { textAlign: 'center', fontFamily: fontFamily.sans400, fontSize: 12, color: colors.textFaint, marginTop: 2 },
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
