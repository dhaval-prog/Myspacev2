import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '../../theme';
import { BottomSheet } from '../expenses/BottomSheet';
import { initialsOf } from './MemberAvatar';
import type { SplitMember } from '../../types/split';

interface SplitMembersSheetProps {
  visible: boolean;
  onClose: () => void;
  groupName: string;
  members: SplitMember[];
}

/** Who's in this split — the owner, then everyone who joined. */
export function SplitMembersSheet({ visible, onClose, groupName, members }: SplitMembersSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.7}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Members</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          on {groupName}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {members.map((member) => (
          <View key={member.userId} style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.initials}>{initialsOf(member.name)}</Text>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {member.name}
            </Text>
            <View style={[styles.badge, member.isOwner && styles.badgeOwner]}>
              <Text style={[styles.badgeLabel, member.isOwner && styles.badgeLabelOwner]}>{member.isOwner ? 'Owner' : 'Member'}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 21,
    color: colors.splitInk,
  },
  subtitle: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.splitInkFaint55,
    maxWidth: '44%',
  },
  list: {
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E9EAFB',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  initials: {
    fontFamily: fontFamily.sans700,
    fontSize: 13,
    letterSpacing: 0.2,
    color: colors.splitInk,
  },
  name: {
    flex: 1,
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: colors.splitInk,
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
  },
  badgeOwner: {
    backgroundColor: colors.splitInk,
  },
  badgeLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 11.5,
    color: colors.splitInkFaint5,
  },
  badgeLabelOwner: {
    color: '#fff',
  },
});
