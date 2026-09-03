import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radius, spacing } from '../../../theme';
import { FriendAvatar } from '../../../components/friends/FriendAvatar';
import type { CircleMember, GameBreakdownEntry, GamePointTransaction } from '../../../types/gameStats';
import { gameTypeLabel } from '../../../types/gameStats';

export function resultGlyph(result: GamePointTransaction['result']): string {
  if (result === 'win') return '🏆';
  if (result === 'loss') return '❌';
  return '🤝';
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface PlayerStatsModalProps {
  member: CircleMember | null;
  breakdown: GameBreakdownEntry[];
  recentActivity: GamePointTransaction[];
  onClose: () => void;
}

/** Compact gaming-stats view — shown when tapping a friend circle or leaderboard node. */
export function PlayerStatsModal({ member, breakdown, recentActivity, onClose }: PlayerStatsModalProps) {
  const favoriteGame = useMemo(() => {
    if (breakdown.length === 0) return null;
    return breakdown.slice().sort((a, b) => b.gamesPlayed - a.gamesPlayed)[0];
  }, [breakdown]);

  return (
    <Modal visible={!!member} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {member && (
            <>
              <View style={styles.header}>
                <FriendAvatar userId={member.userId} name={member.name} avatarUrl={member.avatarUrl} size={64} />
                <Text style={styles.name}>{member.isSelf ? 'You' : member.name}</Text>
                <Text style={styles.points}>{member.stats.totalPoints} Game Points</Text>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statChip}>
                  <Text style={styles.statValue}>🏆 {member.stats.gamesWon}</Text>
                  <Text style={styles.statLabel}>Wins</Text>
                </View>
                <View style={styles.statChip}>
                  <Text style={styles.statValue}>🎮 {member.stats.gamesPlayed}</Text>
                  <Text style={styles.statLabel}>Games</Text>
                </View>
                <View style={styles.statChip}>
                  <Text style={styles.statValue}>❌ {member.stats.gamesLost}</Text>
                  <Text style={styles.statLabel}>Losses</Text>
                </View>
              </View>

              {favoriteGame && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Favorite Game</Text>
                  <Text style={styles.favoriteGame}>{favoriteGame.label}</Text>
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Results</Text>
                {recentActivity.length === 0 ? (
                  <Text style={styles.emptyText}>No games played yet.</Text>
                ) : (
                  <ScrollView style={styles.recentList}>
                    {recentActivity.map((tx) => (
                      <View key={tx.id} style={styles.recentRow}>
                        <Text style={styles.recentGlyph}>{resultGlyph(tx.result)}</Text>
                        <Text style={styles.recentGame} numberOfLines={1}>{gameTypeLabel(tx.gameType)}</Text>
                        <Text style={[styles.recentChange, tx.pointsChange < 0 && styles.negative]}>
                          {tx.pointsChange > 0 ? `+${tx.pointsChange}` : tx.pointsChange}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>

              <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface GameDetailModalProps {
  entry: GameBreakdownEntry | null;
  onClose: () => void;
}

/** Full stat breakdown for a single game type — shown when tapping a Game Breakdown segment. */
export function GameDetailModal({ entry, onClose }: GameDetailModalProps) {
  const winRate = entry && entry.gamesPlayed > 0 ? Math.round((entry.wins / entry.gamesPlayed) * 100) : 0;
  return (
    <Modal visible={!!entry} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {entry && (
            <>
              <Text style={styles.detailTitle}>{entry.label.toUpperCase()}</Text>
              <View style={styles.detailHero}>
                <Text style={styles.detailHeroLabel}>Total Contribution</Text>
                <Text style={[styles.detailHeroValue, entry.net < 0 && styles.negative]}>
                  {entry.net > 0 ? `+${entry.net}` : entry.net} pts
                </Text>
              </View>
              <View style={styles.detailGrid}>
                <DetailRow label="Games Played" value={`${entry.gamesPlayed}`} />
                <DetailRow label="Wins" value={`${entry.wins}`} />
                <DetailRow label="Losses" value={`${entry.losses}`} />
                {entry.draws > 0 && <DetailRow label="Draws" value={`${entry.draws}`} />}
                <DetailRow label="Win Rate" value={`${winRate}%`} />
                <DetailRow label="Points Earned" value={`+${entry.pointsEarned}`} positive />
                <DetailRow label="Points Lost" value={`${entry.pointsLost}`} negative={entry.pointsLost < 0} />
                <DetailRow label="Net Contribution" value={entry.net > 0 ? `+${entry.net}` : `${entry.net}`} positive={entry.net > 0} negative={entry.net < 0} />
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailRow({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, positive && styles.positive, negative && styles.negative]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  header: { alignItems: 'center', gap: 4 },
  name: { fontFamily: fontFamily.sans700, fontSize: 18, color: colors.textPrimary, marginTop: 6 },
  points: { fontFamily: fontFamily.sans600, fontSize: 13.5, color: colors.textMuted },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statChip: { alignItems: 'center', gap: 2 },
  statValue: { fontFamily: fontFamily.sans700, fontSize: 15, color: colors.textPrimary },
  statLabel: { fontFamily: fontFamily.sans400, fontSize: 11.5, color: colors.textMuted },
  section: { gap: 6 },
  sectionTitle: { fontFamily: fontFamily.sans700, fontSize: 12, color: colors.textMuted, letterSpacing: 0.5 },
  favoriteGame: { fontFamily: fontFamily.sans600, fontSize: 14.5, color: colors.textPrimary },
  emptyText: { fontFamily: fontFamily.sans400, fontSize: 13, color: colors.textMuted },
  recentList: { maxHeight: 160 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  recentGlyph: { fontSize: 14 },
  recentGame: { flex: 1, fontFamily: fontFamily.sans500, fontSize: 13.5, color: colors.textPrimary },
  recentChange: { fontFamily: fontFamily.sans700, fontSize: 13.5, color: colors.textPrimary },
  negative: { color: colors.danger },
  positive: { color: '#1F9254' },
  closeBtn: { alignSelf: 'center', marginTop: 4, paddingVertical: 10, paddingHorizontal: 26, borderRadius: radius.pill, backgroundColor: colors.lime },
  closeText: { fontFamily: fontFamily.sans700, fontSize: 13.5, color: colors.ink },
  detailTitle: { fontFamily: fontFamily.sans700, fontSize: 16, color: colors.textPrimary, textAlign: 'center', letterSpacing: 0.5 },
  detailHero: { alignItems: 'center', gap: 2, paddingVertical: 6 },
  detailHeroLabel: { fontFamily: fontFamily.sans400, fontSize: 12.5, color: colors.textMuted },
  detailHeroValue: { fontFamily: fontFamily.sans800, fontSize: 30, color: colors.textPrimary },
  detailGrid: { gap: 2 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  detailLabel: { fontFamily: fontFamily.sans400, fontSize: 13.5, color: colors.textSecondary },
  detailValue: { fontFamily: fontFamily.sans700, fontSize: 13.5, color: colors.textPrimary },
});
