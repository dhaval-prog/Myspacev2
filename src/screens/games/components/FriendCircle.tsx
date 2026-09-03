import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radius, spacing } from '../../../theme';
import { FriendAvatar } from '../../../components/friends/FriendAvatar';
import type { CircleMember } from '../../../types/gameStats';

const MAX_VISIBLE_FRIENDS = 7;
const CONTAINER_SIZE = 300;
const SELF_SIZE = 68;
const FRIEND_SIZE = 56;
const RADIUS = 112;

interface FriendCircleProps {
  self: CircleMember;
  friends: CircleMember[];
  onSelectMember: (member: CircleMember) => void;
}

function Node({ member, size, onPress, muted }: { member: CircleMember; size: number; onPress: () => void; muted?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.node} accessibilityRole="button" accessibilityLabel={`${member.name}, ${member.stats.totalPoints} game points`}>
      <FriendAvatar
        userId={member.userId}
        name={member.name}
        avatarUrl={member.avatarUrl}
        size={size}
        colorOverride={member.isSelf ? { bg: colors.lime, fg: colors.ink } : undefined}
        style={muted ? styles.muted : undefined}
      />
      <Text style={[styles.nodeName, member.isSelf && styles.nodeNameSelf]} numberOfLines={1}>
        {member.isSelf ? 'YOU' : member.name}
      </Text>
      <Text style={styles.nodePoints}>{member.stats.totalPoints} pts</Text>
    </Pressable>
  );
}

/** "Your Circle" — a friend constellation, self in the middle, friends arranged around it. */
export function FriendCircle({ self, friends, onSelectMember }: FriendCircleProps) {
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(() => friends.slice().sort((a, b) => b.stats.totalPoints - a.stats.totalPoints), [friends]);
  const visible = sorted.slice(0, MAX_VISIBLE_FRIENDS);
  const overflowCount = sorted.length - visible.length;

  const positions = useMemo(() => {
    const slots = visible.length + (overflowCount > 0 ? 1 : 0);
    return Array.from({ length: slots }, (_, i) => {
      const angle = (-90 + (360 / slots) * i) * (Math.PI / 180);
      return {
        left: CONTAINER_SIZE / 2 + RADIUS * Math.cos(angle) - FRIEND_SIZE / 2,
        top: CONTAINER_SIZE / 2 + RADIUS * Math.sin(angle) - FRIEND_SIZE / 2,
      };
    });
  }, [visible.length, overflowCount]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.stage, { width: CONTAINER_SIZE, height: CONTAINER_SIZE }]}>
        {visible.map((member, i) => (
          <View key={member.userId} style={[styles.absNode, positions[i]]}>
            <Node member={member} size={FRIEND_SIZE} onPress={() => onSelectMember(member)} />
          </View>
        ))}
        {overflowCount > 0 && (
          <View style={[styles.absNode, positions[visible.length]]}>
            <Pressable onPress={() => setShowAll(true)} style={styles.node} accessibilityRole="button" accessibilityLabel={`View ${overflowCount} more friends`}>
              <View style={[styles.overflowCircle, { width: FRIEND_SIZE, height: FRIEND_SIZE, borderRadius: FRIEND_SIZE / 2 }]}>
                <Text style={styles.overflowText}>+{overflowCount}</Text>
              </View>
              <Text style={styles.nodeName}>More</Text>
            </Pressable>
          </View>
        )}
        <View style={[styles.absNode, { left: CONTAINER_SIZE / 2 - SELF_SIZE / 2, top: CONTAINER_SIZE / 2 - SELF_SIZE / 2 }]}>
          <Node member={self} size={SELF_SIZE} onPress={() => onSelectMember(self)} />
        </View>
      </View>

      {sorted.length > 0 && (
        <Pressable onPress={() => setShowAll(true)} style={styles.viewAllBtn} accessibilityRole="button">
          <Text style={styles.viewAllText}>View All Friends ({sorted.length})</Text>
        </Pressable>
      )}

      <Modal visible={showAll} transparent animationType="fade" onRequestClose={() => setShowAll(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowAll(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Your Circle</Text>
            <ScrollView contentContainerStyle={styles.sheetGrid} showsVerticalScrollIndicator={false}>
              {sorted.map((member) => (
                <Pressable
                  key={member.userId}
                  style={styles.sheetRow}
                  onPress={() => {
                    setShowAll(false);
                    onSelectMember(member);
                  }}
                >
                  <FriendAvatar userId={member.userId} name={member.name} avatarUrl={member.avatarUrl} size={44} />
                  <Text style={styles.sheetRowName} numberOfLines={1}>{member.name}</Text>
                  <Text style={styles.sheetRowPoints}>{member.stats.totalPoints} pts</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setShowAll(false)} style={styles.sheetClose} accessibilityRole="button">
              <Text style={styles.sheetCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  stage: { alignSelf: 'center' },
  absNode: { position: 'absolute' },
  node: { alignItems: 'center', width: 78, gap: 2 },
  muted: { opacity: 0.85 },
  nodeName: { fontFamily: fontFamily.sans600, fontSize: 12, color: colors.textPrimary, maxWidth: 78 },
  nodeNameSelf: { color: colors.ink },
  nodePoints: { fontFamily: fontFamily.sans400, fontSize: 11, color: colors.textMuted },
  overflowCircle: { backgroundColor: colors.ink10, alignItems: 'center', justifyContent: 'center' },
  overflowText: { fontFamily: fontFamily.sans700, fontSize: 15, color: colors.textPrimary },
  viewAllBtn: { marginTop: spacing.sm, paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.surface70 },
  viewAllText: { fontFamily: fontFamily.sans600, fontSize: 12.5, color: colors.textPrimary },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: '70%' },
  sheetTitle: { fontFamily: fontFamily.sans700, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.sm },
  sheetGrid: { gap: 2, paddingBottom: spacing.sm },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  sheetRowName: { flex: 1, fontFamily: fontFamily.sans600, fontSize: 14.5, color: colors.textPrimary },
  sheetRowPoints: { fontFamily: fontFamily.sans700, fontSize: 14, color: colors.textPrimary },
  sheetClose: { marginTop: spacing.sm, alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 24, borderRadius: radius.pill, backgroundColor: colors.lime },
  sheetCloseText: { fontFamily: fontFamily.sans700, fontSize: 13.5, color: colors.ink },
});
