import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '../../theme';
import { BottomSheet } from '../expenses/BottomSheet';
import { ConfirmDialog } from '../ConfirmDialog';
import { MemberAvatar } from './MemberAvatar';
import { useAuth } from '../../context/AuthContext';
import { useFriends } from '../../context/FriendsContext';
import type { SplitMember } from '../../types/split';

interface SplitMembersSheetProps {
  visible: boolean;
  onClose: () => void;
  groupName: string;
  members: SplitMember[];
}

/** Who's in this split — the owner, then everyone who joined. Tap someone to send a friend request. */
export function SplitMembersSheet({ visible, onClose, groupName, members }: SplitMembersSheetProps) {
  const { user } = useAuth();
  const { relationshipWith, sendRequestToUser } = useFriends();
  const [selected, setSelected] = useState<SplitMember | null>(null);
  const [sent, setSent] = useState(false);

  const relationship = selected ? relationshipWith(selected.userId) : 'none';

  const dialogCopy = (() => {
    if (!selected) return null;
    if (sent) return { title: 'Request sent', message: `Your friend request to ${selected.name} is on its way.`, hideCancel: true, confirmLabel: 'OK' };
    if (relationship === 'already_friends') return { title: 'Already friends', message: `You and ${selected.name} are already friends.`, hideCancel: true, confirmLabel: 'OK' };
    if (relationship === 'already_pending') return { title: 'Request pending', message: `A friend request with ${selected.name} is already pending.`, hideCancel: true, confirmLabel: 'OK' };
    return { title: 'Send friend request?', message: `Send ${selected.name} a friend request?`, hideCancel: false, confirmLabel: 'Send' };
  })();

  const closeDialog = () => {
    setSelected(null);
    setSent(false);
  };

  const confirm = async () => {
    if (sent || relationship !== 'none' || !selected) {
      closeDialog();
      return;
    }
    const { error } = await sendRequestToUser(selected.userId);
    if (!error) setSent(true);
    else closeDialog();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.7}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Members</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          on {groupName}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {members.map((member) => {
          const isSelf = member.userId === user?.id;
          const row = (
            <View style={styles.row}>
              <MemberAvatar userId={member.userId} name={member.name} size={36} avatarUrl={member.avatarUrl} />
              <Text style={styles.name} numberOfLines={1}>
                {member.name}
              </Text>
              <View style={[styles.badge, member.isOwner && styles.badgeOwner]}>
                <Text style={[styles.badgeLabel, member.isOwner && styles.badgeLabelOwner]}>{member.isOwner ? 'Owner' : 'Member'}</Text>
              </View>
            </View>
          );
          if (isSelf) return <View key={member.userId}>{row}</View>;
          return (
            <Pressable key={member.userId} onPress={() => setSelected(member)} accessibilityRole="button" accessibilityLabel={`${member.name}, send friend request`}>
              {row}
            </Pressable>
          );
        })}
      </ScrollView>

      <ConfirmDialog
        visible={!!selected && !!dialogCopy}
        title={dialogCopy?.title ?? ''}
        message={dialogCopy?.message ?? ''}
        confirmLabel={dialogCopy?.confirmLabel ?? 'OK'}
        hideCancel={dialogCopy?.hideCancel}
        onConfirm={confirm}
        onCancel={closeDialog}
      />
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
