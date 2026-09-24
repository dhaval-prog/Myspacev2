import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../Icon';
import { FriendAvatar } from '../friends/FriendAvatar';
import { HubSheet } from './HubSheet';
import { ghColor, ghFont } from '../../theme/gamesHubTokens';
import { gameTypeShortLabel } from '../../types/gameStats';
import type { GameBreakdownEntry, LeaderboardEntry } from '../../types/gameStats';

const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';
const TABS = ['This week', 'All time', 'By game'] as const;

function subtitleFor(breakdown: GameBreakdownEntry[]): string {
  return breakdown.map((b) => `${gameTypeShortLabel(b.gameType)} ${Math.max(0, b.net)}`).join(' · ') || 'No games yet';
}

interface LeaderboardSheetProps {
  visible: boolean;
  onClose: () => void;
  leaderboard: LeaderboardEntry[];
  breakdownFor: (userId: string) => GameBreakdownEntry[];
  reduceMotion?: boolean;
}

/** The full ranked leaderboard — opened from "See all" or the points sheet's "See full leaderboard". */
export function LeaderboardSheet({ visible, onClose, leaderboard, breakdownFor, reduceMotion }: LeaderboardSheetProps) {
  const self = leaderboard.find((e) => e.isSelf);
  const leader = leaderboard[0];
  const gapToFirst = self && leader && self.userId !== leader.userId ? leader.stats.totalPoints - self.stats.totalPoints : 0;

  return (
    <HubSheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Leaderboard</Text>
          <Text style={styles.subtitle}>Your circle · {leaderboard.length} player{leaderboard.length === 1 ? '' : 's'}</Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
          <Icon path={CLOSE_ICON} color={ghColor.sheetTextPrimary} size={15} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t, i) => (
          <View key={t} style={[styles.tab, i === 0 && styles.tabActive]}>
            {i === 0 && (
              <LinearGradient colors={[ghColor.gradientA, ghColor.gradientB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { zIndex: -1 }]} pointerEvents="none" />
            )}
            <Text style={[styles.tabLabel, i === 0 && styles.tabLabelActive]}>{t}</Text>
          </View>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list} contentContainerStyle={styles.listContent}>
        {leaderboard.map((entry) => {
          const isLeader = entry.rank === 1;
          const highlight = entry.isSelf;
          return (
            <View key={entry.userId} style={[styles.row, isLeader && styles.rowLeader, highlight && styles.rowSelf]}>
              <Text style={[styles.rank, isLeader && styles.rankLeader, highlight && styles.rankSelf]}>{entry.rank}</Text>
              <FriendAvatar
                userId={entry.userId}
                name={entry.name}
                avatarUrl={entry.avatarUrl}
                size={32}
                radius={16}
                initialsFontFamily={ghFont.sans800}
                initialsFontSize={11}
                colorOverride={highlight ? { bg: ghColor.gradientB, fg: ghColor.textOnGradient } : undefined}
              />
              <View style={styles.rowMid}>
                <Text style={[styles.rowName, highlight && styles.rowNameSelf]}>{entry.isSelf ? 'You' : entry.name}</Text>
                <Text style={[styles.rowSub, highlight && styles.rowSubSelf]}>{subtitleFor(breakdownFor(entry.userId))}</Text>
              </View>
              <Text style={[styles.rowPoints, highlight && styles.rowPointsSelf]}>{entry.stats.totalPoints}</Text>
            </View>
          );
        })}
      </ScrollView>

      <Text style={styles.footer}>{self && leader && self.userId !== leader.userId ? `${gapToFirst} points to overtake ${leader.name}` : "You're in the lead"}</Text>
    </HubSheet>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: ghFont.sans800, fontSize: 21, letterSpacing: -0.7, color: ghColor.sheetTextPrimary },
  subtitle: { fontFamily: ghFont.sans400, fontSize: 11.5, color: ghColor.sheetTextSecondary, marginTop: 5 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: ghColor.sheetSurface, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: ghColor.sheetSurface, borderRadius: 999, padding: 3, marginTop: 14 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999, overflow: 'hidden' },
  tabActive: {},
  tabLabel: { fontFamily: ghFont.sans500, fontSize: 11.5, color: ghColor.sheetTextSecondary },
  tabLabelActive: { fontFamily: ghFont.sans700, color: ghColor.textOnGradient },
  list: { marginTop: 12 },
  listContent: { gap: 6, paddingBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: ghColor.sheetRowFill,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ghColor.sheetRowBorder,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  rowLeader: { backgroundColor: ghColor.sheetLeaderBg },
  rowSelf: { backgroundColor: ghColor.sheetSelfFill, borderColor: ghColor.sheetSelfBorder },
  rank: { width: 19, fontFamily: ghFont.mono500, fontSize: 12, color: ghColor.sheetTextTertiary },
  rankLeader: { fontFamily: ghFont.sans800, color: ghColor.sheetTextPrimary },
  rankSelf: { color: ghColor.sheetAccentOnLight },
  rowMid: { flex: 1 },
  rowName: { fontFamily: ghFont.sans700, fontSize: 13, color: ghColor.sheetTextPrimary },
  rowNameSelf: {},
  rowSub: { fontFamily: ghFont.mono500, fontSize: 9.5, color: ghColor.sheetTextTertiary, marginTop: 4 },
  rowSubSelf: {},
  rowPoints: { fontFamily: ghFont.sans800, fontSize: 15, color: ghColor.sheetTextPrimary },
  rowPointsSelf: { color: ghColor.sheetAccentOnLight },
  footer: { marginTop: 12, textAlign: 'center', fontFamily: ghFont.sans400, fontSize: 10.5, color: ghColor.sheetTextFaint },
});
