import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radius, spacing } from '../../../theme';
import { FriendAvatar } from '../../../components/friends/FriendAvatar';
import type { LeaderboardEntry } from '../../../types/gameStats';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function RankNode({ entry, size, onPress }: { entry: LeaderboardEntry; size: number; onPress: () => void }) {
  const medal = MEDALS[entry.rank];
  return (
    <Pressable onPress={onPress} style={styles.node} accessibilityRole="button" accessibilityLabel={`Rank ${entry.rank}, ${entry.name}, ${entry.stats.totalPoints} points`}>
      <View style={entry.isSelf ? styles.selfRing : undefined}>
        <FriendAvatar userId={entry.userId} name={entry.name} avatarUrl={entry.avatarUrl} size={size} />
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{medal ?? `#${entry.rank}`}</Text>
      </View>
      <Text style={[styles.name, entry.isSelf && styles.nameSelf]} numberOfLines={1}>
        {entry.isSelf ? 'YOU' : entry.name.toUpperCase()}
      </Text>
      <Text style={styles.points}>{entry.stats.totalPoints} pts</Text>
    </Pressable>
  );
}

interface LeadershipCircleProps {
  leaderboard: LeaderboardEntry[];
  onSelectMember: (entry: LeaderboardEntry) => void;
}

/** Podium-style ranking among the user's own friend circle only. */
export function LeadershipCircle({ leaderboard, onSelectMember }: LeadershipCircleProps) {
  const first = leaderboard.filter((e) => e.rank === 1);
  const second = leaderboard.filter((e) => e.rank === 2);
  const third = leaderboard.filter((e) => e.rank === 3);
  const usedRanks = new Set([...first, ...second, ...third].map((e) => e.userId));
  const rest = leaderboard.filter((e) => !usedRanks.has(e.userId));

  return (
    <View style={styles.wrap}>
      {first.length > 0 && (
        <View style={styles.podiumRow}>
          {first.map((e) => (
            <RankNode key={e.userId} entry={e} size={72} onPress={() => onSelectMember(e)} />
          ))}
        </View>
      )}
      {(second.length > 0 || third.length > 0) && (
        <View style={[styles.podiumRow, styles.podiumRowSecond]}>
          {second.map((e) => (
            <RankNode key={e.userId} entry={e} size={60} onPress={() => onSelectMember(e)} />
          ))}
          {third.map((e) => (
            <RankNode key={e.userId} entry={e} size={60} onPress={() => onSelectMember(e)} />
          ))}
        </View>
      )}
      {rest.length > 0 && (
        <View style={styles.restList}>
          {rest.map((e) => (
            <Pressable key={e.userId} onPress={() => onSelectMember(e)} style={[styles.restRow, e.isSelf && styles.restRowSelf]}>
              <Text style={styles.restRank}>#{e.rank}</Text>
              <FriendAvatar userId={e.userId} name={e.name} avatarUrl={e.avatarUrl} size={36} />
              <Text style={[styles.restName, e.isSelf && styles.nameSelf]} numberOfLines={1}>
                {e.isSelf ? 'You' : e.name}
              </Text>
              <Text style={styles.restPoints}>{e.stats.totalPoints} pts</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  podiumRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  podiumRowSecond: { gap: spacing.huge },
  node: { alignItems: 'center', width: 90, gap: 2 },
  selfRing: { borderRadius: 999, borderWidth: 3, borderColor: colors.lime, padding: 2 },
  badge: { marginTop: -10, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, shadowColor: colors.ink, shadowOpacity: 0.12, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  badgeText: { fontSize: 13, fontFamily: fontFamily.sans700 },
  name: { fontFamily: fontFamily.sans600, fontSize: 12.5, color: colors.textPrimary, marginTop: 2 },
  nameSelf: { color: colors.ink },
  points: { fontFamily: fontFamily.sans400, fontSize: 11.5, color: colors.textMuted },
  restList: { gap: 8 },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface60, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 12 },
  restRowSelf: { backgroundColor: 'rgba(195,234,79,0.35)' },
  restRank: { width: 26, fontFamily: fontFamily.sans700, fontSize: 13, color: colors.textMuted },
  restName: { flex: 1, fontFamily: fontFamily.sans600, fontSize: 14, color: colors.textPrimary },
  restPoints: { fontFamily: fontFamily.sans700, fontSize: 13.5, color: colors.textPrimary },
});
