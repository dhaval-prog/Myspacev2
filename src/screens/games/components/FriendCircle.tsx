import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radius, spacing } from '../../../theme';
import { FriendAvatar } from '../../../components/friends/FriendAvatar';
import type { CircleMember } from '../../../types/gameStats';

const NODE_SIZE = 56;
const SELF_SIZE = 64;

interface FriendCircleProps {
  self: CircleMember;
  friends: CircleMember[];
  onSelectMember: (member: CircleMember) => void;
}

function Node({ member, size, onPress }: { member: CircleMember; size: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.node} accessibilityRole="button" accessibilityLabel={`${member.name}, ${member.stats.totalPoints} game points`}>
      <FriendAvatar
        userId={member.userId}
        name={member.name}
        avatarUrl={member.avatarUrl}
        size={size}
        colorOverride={member.isSelf ? { bg: colors.lime, fg: colors.ink } : undefined}
      />
      <Text style={[styles.nodeName, member.isSelf && styles.nodeNameSelf]} numberOfLines={1}>
        {member.isSelf ? 'YOU' : member.name}
      </Text>
      <Text style={styles.nodePoints}>{member.stats.totalPoints} pts</Text>
    </Pressable>
  );
}

/** "Your Circle" — a single scrollable line, self first, friends ranked by Game Points after. */
export function FriendCircle({ self, friends, onSelectMember }: FriendCircleProps) {
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(() => friends.slice().sort((a, b) => b.stats.totalPoints - a.stats.totalPoints), [friends]);

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Node member={self} size={SELF_SIZE} onPress={() => onSelectMember(self)} />
        {sorted.map((member) => (
          <Node key={member.userId} member={member} size={NODE_SIZE} onPress={() => onSelectMember(member)} />
        ))}
      </ScrollView>

      {sorted.length > 5 && (
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
  row: { flexDirection: 'row', gap: 16, paddingHorizontal: 2, paddingVertical: 2 },
  node: { alignItems: 'center', width: 74, gap: 2 },
  nodeName: { fontFamily: fontFamily.sans600, fontSize: 12, color: colors.textPrimary, maxWidth: 74 },
  nodeNameSelf: { color: colors.ink },
  nodePoints: { fontFamily: fontFamily.sans400, fontSize: 11, color: colors.textMuted },
  viewAllBtn: { marginTop: spacing.sm, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.surface70 },
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
