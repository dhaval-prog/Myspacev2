import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { BottomNav } from '../../components/BottomNav';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { GameRow } from '../../components/gameshub/GameRow';
import { LeaderboardSheet } from '../../components/gameshub/LeaderboardSheet';
import { PointsSheet } from '../../components/gameshub/PointsSheet';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useGameStats } from '../../context/GameStatsContext';
import { ghColor, ghFont } from '../../theme/gamesHubTokens';

const CHEV_ICON = 'M9 6l6 6-6 6';
const PLUS_ICON = 'M12 5v14M5 12h14';
const RING_SIZE = 88;
const RING_HOLE = 68;
const RING_THICKNESS = (RING_SIZE - RING_HOLE) / 2;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function badgeStyleFor(rank: number) {
  if (rank === 1) return { bg: ghColor.gold, fg: ghColor.ink };
  if (rank === 2) return { bg: ghColor.ink, fg: ghColor.lime };
  return { bg: ghColor.ink16, fg: ghColor.ink };
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function ProgressRing({ pct, reduceMotion, children }: { pct: number; reduceMotion?: boolean; children: React.ReactNode }) {
  const progress = useRef(new Animated.Value(reduceMotion ? pct : 0)).current;
  const radius = (RING_SIZE - RING_THICKNESS) / 2;
  const circumference = 2 * Math.PI * radius;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(progress, { toValue: pct, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct, reduceMotion, progress]);
  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });
  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={radius} stroke={ghColor.ink09} strokeWidth={RING_THICKNESS} fill="none" />
        <AnimatedCircle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          stroke={ghColor.lime}
          strokeWidth={RING_THICKNESS}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="butt"
          rotation="-90"
          originX={RING_SIZE / 2}
          originY={RING_SIZE / 2}
        />
      </Svg>
      <View style={styles.ringCenter}>{children}</View>
    </View>
  );
}

interface GamesDashboardScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  onOpenFriends: () => void;
  onOpenNpat: (initialTab?: 'create' | 'join') => void;
  onOpenCards: (initialTab?: 'create' | 'join') => void;
}

/**
 * The Games hub — restyled to the "MySpace Games · 3A · A Tabletop" handoff.
 * Real leaderboard/points data from GameStatsContext throughout; a game row
 * expands in place into Create/Join instead of pushing a new screen.
 */
export function GamesDashboardScreen({ onHome, onOpenExpenses, onOpenSplit, onOpenFriends, onOpenNpat, onOpenCards }: GamesDashboardScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { circle, leaderboard, myEntry, myRankDelta, breakdown, recentActivity, breakdownFor } = useGameStats();

  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [pointsVisible, setPointsVisible] = useState(false);
  const [expandedRow, setExpandedRow] = useState<'npat' | 'cards' | null>(null);

  const myTotal = myEntry?.stats.totalPoints ?? 0;
  const leader = leaderboard[0];
  const topThree = leaderboard.slice(0, 3);
  const leaderPoints = leader?.stats.totalPoints ?? 0;
  const ringPct = leaderPoints > 0 ? Math.max(0.06, Math.min(1, myTotal / leaderPoints)) : myTotal > 0 ? 1 : 0.06;
  const gapToFirst = myEntry && myEntry.rank > 1 ? leaderPoints - myTotal : 0;
  const weeklyDelta = recentActivity.filter((tx) => Date.now() - new Date(tx.createdAt).getTime() <= WEEK_MS).reduce((sum, tx) => sum + tx.pointsChange, 0);
  const npat = breakdown.find((b) => b.gameType === 'NPAT');
  const cards = breakdown.find((b) => b.gameType === 'CARDS');

  return (
    <LinearGradient colors={[ghColor.bgTop, ghColor.bgMid, ghColor.bgBottom]} locations={[0, 0.46, 1]} style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 100 }]}>
        <Text style={styles.title}>Games</Text>
        <Text style={styles.subtitle}>Your gaming circle · {circle.length} seated</Text>

        <View style={styles.eyebrowRow}>
          <Text style={styles.eyebrow}>LEADERBOARD · THIS WEEK</Text>
          <Pressable onPress={() => setLeaderboardVisible(true)} style={styles.seeAll} accessibilityRole="button" accessibilityLabel="See all">
            <Text style={styles.seeAllLabel}>See all</Text>
            <Icon path={CHEV_ICON} color={ghColor.up} size={12} strokeWidth={2.4} />
          </Pressable>
        </View>

        <View style={styles.topRow}>
          {topThree.map((entry) => {
            const badge = badgeStyleFor(entry.rank);
            return (
              <View key={entry.userId} style={styles.topItem}>
                <View style={styles.topAvatarWrap}>
                  <FriendAvatar
                    userId={entry.userId}
                    name={entry.name}
                    avatarUrl={entry.avatarUrl}
                    size={56}
                    radius={28}
                    initialsFontFamily={ghFont.sans800}
                    initialsFontSize={entry.isSelf ? 17 : 16}
                    colorOverride={entry.isSelf ? { bg: ghColor.lime, fg: ghColor.ink } : { bg: '#FFFFFF', fg: ghColor.avatarMuted }}
                  />
                  <View style={[styles.rankBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.rankBadgeLabel, { color: badge.fg }]}>{entry.rank}</Text>
                  </View>
                </View>
                <Text style={[styles.topName, entry.isSelf && styles.topNameSelf]}>{entry.isSelf ? 'You' : entry.name}</Text>
                <Text style={[styles.topPoints, entry.isSelf && styles.topPointsSelf]}>{entry.stats.totalPoints}</Text>
              </View>
            );
          })}
          <Pressable onPress={onOpenFriends} style={styles.inviteItem} accessibilityRole="button" accessibilityLabel="Invite a friend">
            <View style={styles.inviteCircle}>
              <Icon path={PLUS_ICON} color={ghColor.ink45} size={20} strokeWidth={2.2} />
            </View>
            <Text style={styles.inviteLabel}>INVITE</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => setPointsVisible(true)} style={styles.pointsCard} accessibilityRole="button" accessibilityLabel="Your points">
          <ProgressRing pct={ringPct} reduceMotion={reduceMotion}>
            <Text style={styles.ringValue}>{myTotal}</Text>
            <Text style={styles.ringLabel}>POINTS</Text>
          </ProgressRing>
          <View style={styles.pointsMid}>
            <View style={styles.rankRow}>
              <Text style={styles.rankTitle}>Rank #{myEntry?.rank ?? '—'}</Text>
              {myRankDelta !== null && myRankDelta !== 0 && (
                <View style={styles.rankDeltaChip}>
                  <Text style={styles.rankDeltaGlyph}>{myRankDelta > 0 ? '▲' : '▼'}</Text>
                  <Text style={styles.rankDeltaLabel}>{Math.abs(myRankDelta)}</Text>
                </View>
              )}
              <Text style={styles.gapLabel} numberOfLines={1}>
                {myEntry && myEntry.rank > 1 ? `${gapToFirst} TO #1` : 'LEADING'}
              </Text>
            </View>
            <BreakdownBar label="NPAT" value={npat?.net ?? 0} total={myTotal} color={ghColor.lime} />
            <BreakdownBar label="CARDS" value={cards?.net ?? 0} total={myTotal} color={ghColor.gold} />
          </View>
        </Pressable>

        <Text style={styles.playEyebrow}>PLAY A GAME</Text>

        <GameRow
          variant="npat"
          title="Name, Place, Animal, Thing"
          subtitle="5 rounds · 60s each"
          expanded={expandedRow === 'npat'}
          onToggle={() => setExpandedRow((r) => (r === 'npat' ? null : 'npat'))}
          onCreate={() => onOpenNpat('create')}
          onJoin={() => onOpenNpat('join')}
        />
        <GameRow
          variant="cards"
          title="Space Cards"
          subtitle="2–4 players · shed your hand"
          expanded={expandedRow === 'cards'}
          onToggle={() => setExpandedRow((r) => (r === 'cards' ? null : 'cards'))}
          onCreate={() => onOpenCards('create')}
          onJoin={() => onOpenCards('join')}
        />
      </ScrollView>

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

      <LeaderboardSheet visible={leaderboardVisible} onClose={() => setLeaderboardVisible(false)} leaderboard={leaderboard} breakdownFor={breakdownFor} reduceMotion={reduceMotion} />
      <PointsSheet
        visible={pointsVisible}
        onClose={() => setPointsVisible(false)}
        myEntry={myEntry}
        circleSize={circle.length}
        breakdown={breakdown}
        recentActivity={recentActivity}
        weeklyDelta={weeklyDelta}
        onSeeLeaderboard={() => {
          setPointsVisible(false);
          setLeaderboardVisible(true);
        }}
        reduceMotion={reduceMotion}
      />
    </LinearGradient>
  );
}

function BreakdownBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  title: { fontFamily: ghFont.sans800, fontSize: 30, lineHeight: 30, letterSpacing: -1.2, color: ghColor.ink },
  subtitle: { fontFamily: ghFont.sans400, fontSize: 12.5, color: ghColor.ink52, marginTop: 6 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 16, marginBottom: 9 },
  eyebrow: { fontFamily: ghFont.mono500, fontSize: 9.5, letterSpacing: 9.5 * 0.14, color: ghColor.ink42 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllLabel: { fontFamily: ghFont.sans600, fontSize: 11, color: ghColor.up },
  topRow: { flexDirection: 'row', gap: 9 },
  topItem: { flex: 1, alignItems: 'center', gap: 6 },
  topAvatarWrap: { width: 56, height: 56 },
  rankBadge: { position: 'absolute', left: -2, top: -3, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: ghColor.bgMid, alignItems: 'center', justifyContent: 'center' },
  rankBadgeLabel: { fontFamily: ghFont.mono500, fontSize: 9 },
  topName: { fontFamily: ghFont.sans600, fontSize: 10, color: ghColor.ink, textAlign: 'center' },
  topNameSelf: { fontFamily: ghFont.sans700 },
  topPoints: { fontFamily: ghFont.mono500, fontSize: 9.5, letterSpacing: 9.5 * 0.06, color: ghColor.ink50, marginTop: -3 },
  topPointsSelf: { fontFamily: ghFont.sans700, color: ghColor.ink },
  inviteItem: { flex: 1, alignItems: 'center', gap: 6 },
  inviteCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.6, borderStyle: 'dashed', borderColor: ghColor.ink28, alignItems: 'center', justifyContent: 'center' },
  inviteLabel: { fontFamily: ghFont.mono500, fontSize: 9.5, letterSpacing: 9.5 * 0.1, color: ghColor.ink42 },
  pointsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 16,
    shadowColor: ghColor.ink,
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 30,
  },
  ringWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringValue: { fontFamily: ghFont.sans800, fontSize: 24, letterSpacing: -1.2, color: ghColor.ink },
  ringLabel: { fontFamily: ghFont.mono500, fontSize: 8, letterSpacing: 8 * 0.12, color: ghColor.ink42 },
  pointsMid: { flex: 1, gap: 8 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rankTitle: { fontFamily: ghFont.sans800, fontSize: 15, color: ghColor.ink },
  rankDeltaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: ghColor.upBg, paddingVertical: 4, paddingHorizontal: 7, borderRadius: 999 },
  rankDeltaGlyph: { fontSize: 8, color: ghColor.up },
  rankDeltaLabel: { fontFamily: ghFont.mono500, fontSize: 9.5, color: ghColor.up },
  gapLabel: { flex: 1, textAlign: 'right', fontFamily: ghFont.mono500, fontSize: 9.5, letterSpacing: 9.5 * 0.06, color: ghColor.ink40 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  barLabel: { width: 40, fontFamily: ghFont.mono500, fontSize: 9, letterSpacing: 9 * 0.06, color: ghColor.ink45 },
  barTrack: { flex: 1, height: 8, borderRadius: 999, backgroundColor: ghColor.ink07, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  barValue: { width: 30, textAlign: 'right', fontFamily: ghFont.mono500, fontSize: 10.5, color: ghColor.ink },
  playEyebrow: { fontFamily: ghFont.mono500, fontSize: 9.5, letterSpacing: 9.5 * 0.14, color: ghColor.ink42, marginTop: 18, marginBottom: 10 },
});
