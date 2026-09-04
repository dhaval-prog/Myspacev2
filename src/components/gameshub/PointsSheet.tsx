import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { HubSheet } from './HubSheet';
import { ghColor, ghFont } from '../../theme/gamesHubTokens';
import type { GameBreakdownEntry, GamePointTransaction, LeaderboardEntry } from '../../types/gameStats';

const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return 'TODAY';
  if (sameDay(d, yesterday)) return 'YESTERDAY';
  return d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${dayLabel(iso)} · ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

function describeTx(tx: GamePointTransaction): string {
  const noun = tx.gameType === 'NPAT' ? 'round' : 'game';
  const gameLabel = tx.gameType === 'NPAT' ? 'NPAT' : 'Space Cards';
  if (tx.result === 'win') return `${gameLabel} ${noun} won`;
  if (tx.result === 'loss') return `${gameLabel} ${noun} lost`;
  return `${gameLabel} ${noun} drawn`;
}

interface PointsSheetProps {
  visible: boolean;
  onClose: () => void;
  myEntry: LeaderboardEntry | null;
  circleSize: number;
  breakdown: GameBreakdownEntry[];
  recentActivity: GamePointTransaction[];
  weeklyDelta: number;
  onSeeLeaderboard: () => void;
  reduceMotion?: boolean;
}

/** Your own points ledger — opened by tapping the hero points card. */
export function PointsSheet({ visible, onClose, myEntry, circleSize, breakdown, recentActivity, weeklyDelta, onSeeLeaderboard, reduceMotion }: PointsSheetProps) {
  const total = myEntry?.stats.totalPoints ?? 0;
  const npat = breakdown.find((b) => b.gameType === 'NPAT');
  const cards = breakdown.find((b) => b.gameType === 'CARDS');

  return (
    <HubSheet visible={visible} onClose={onClose} reduceMotion={reduceMotion}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Your points</Text>
          <Text style={styles.subtitle}>This week · rank #{myEntry?.rank ?? '—'} of {circleSize}</Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
          <Icon path={CLOSE_ICON} color={ghColor.ink} size={15} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={styles.heroRow}>
        <Text style={styles.heroValue}>{total}</Text>
        {weeklyDelta !== 0 && (
          <View style={styles.deltaChip}>
            <Text style={styles.deltaGlyph}>{weeklyDelta > 0 ? '▲' : '▼'}</Text>
            <Text style={styles.deltaLabel}>{weeklyDelta > 0 ? '+' : ''}{weeklyDelta} THIS WEEK</Text>
          </View>
        )}
      </View>

      <View style={styles.tilesRow}>
        <View style={[styles.tile, { backgroundColor: ghColor.npatTile }]}>
          <Text style={styles.tileLabel}>NPAT</Text>
          <Text style={styles.tileValue}>{npat?.net ?? 0}</Text>
          <Text style={styles.tileSub}>{npat?.gamesPlayed ?? 0} rounds · {npat?.wins ?? 0} wins</Text>
        </View>
        <View style={[styles.tile, { backgroundColor: ghColor.cardsTile }]}>
          <Text style={styles.tileLabel}>SPACE CARDS</Text>
          <Text style={styles.tileValue}>{cards?.net ?? 0}</Text>
          <Text style={styles.tileSub}>{cards?.gamesPlayed ?? 0} games · {cards?.wins ?? 0} wins</Text>
        </View>
      </View>

      <Text style={styles.eyebrow}>HOW YOU EARNED IT</Text>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.list} contentContainerStyle={styles.listContent}>
        {recentActivity.length === 0 ? (
          <Text style={styles.emptyText}>No games played yet.</Text>
        ) : (
          recentActivity.slice(0, 12).map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={[styles.txBadge, { backgroundColor: tx.gameType === 'NPAT' ? ghColor.lime : ghColor.gold }]}>
                <Text style={styles.txBadgeLabel}>{tx.gameType === 'NPAT' ? 'N' : 'S'}</Text>
              </View>
              <View style={styles.txMid}>
                <Text style={styles.txTitle}>{describeTx(tx)}</Text>
                <Text style={styles.txTime}>{timeLabel(tx.createdAt)}</Text>
              </View>
              <Text style={[styles.txChange, tx.pointsChange < 0 && styles.txChangeNegative]}>
                {tx.pointsChange > 0 ? `+${tx.pointsChange}` : tx.pointsChange}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <Pressable onPress={onSeeLeaderboard} style={styles.cta} accessibilityRole="button">
        <Text style={styles.ctaLabel}>See full leaderboard</Text>
      </Pressable>
    </HubSheet>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontFamily: ghFont.sans800, fontSize: 21, letterSpacing: -0.7, color: ghColor.ink },
  subtitle: { fontFamily: ghFont.sans400, fontSize: 11.5, color: ghColor.ink50, marginTop: 5 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: ghColor.ink06, alignItems: 'center', justifyContent: 'center' },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, marginTop: 14 },
  heroValue: { fontFamily: ghFont.sans800, fontSize: 46, letterSpacing: -2, color: ghColor.ink },
  deltaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: ghColor.upBg, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 999, marginBottom: 7 },
  deltaGlyph: { fontSize: 8, color: ghColor.up },
  deltaLabel: { fontFamily: ghFont.mono500, fontSize: 10.5, color: ghColor.up },
  tilesRow: { flexDirection: 'row', gap: 9, marginTop: 14 },
  tile: { flex: 1, borderRadius: 18, padding: 13 },
  tileLabel: { fontFamily: ghFont.mono500, fontSize: 8.5, letterSpacing: 8.5 * 0.12, color: ghColor.ink50 },
  tileValue: { fontFamily: ghFont.sans800, fontSize: 24, letterSpacing: -1, color: ghColor.ink, marginTop: 8 },
  tileSub: { fontFamily: ghFont.sans400, fontSize: 10, color: ghColor.ink50, marginTop: 6 },
  eyebrow: { fontFamily: ghFont.mono500, fontSize: 9.5, letterSpacing: 9.5 * 0.14, color: ghColor.ink42, marginTop: 18, marginBottom: 9 },
  list: { maxHeight: 280 },
  listContent: { gap: 5, paddingBottom: 2 },
  emptyText: { fontFamily: ghFont.sans400, fontSize: 13, color: ghColor.ink45, textAlign: 'center', paddingVertical: 12 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: ghColor.rowMuted, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 13 },
  txBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  txBadgeLabel: { fontFamily: ghFont.sans800, fontSize: 10, color: ghColor.ink },
  txMid: { flex: 1 },
  txTitle: { fontFamily: ghFont.sans700, fontSize: 12.5, color: ghColor.ink },
  txTime: { fontFamily: ghFont.mono500, fontSize: 9.5, color: ghColor.ink42, marginTop: 4 },
  txChange: { fontFamily: ghFont.mono500, fontSize: 13, color: ghColor.up },
  txChangeNegative: { color: ghColor.danger },
  cta: { marginTop: 14, paddingVertical: 15, borderRadius: 999, backgroundColor: ghColor.lime, alignItems: 'center' },
  ctaLabel: { fontFamily: ghFont.sans700, fontSize: 14, color: ghColor.ink },
});
