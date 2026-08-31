import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '../../theme';
import { BottomSheet } from './BottomSheet';
import { ConfirmDialog } from '../ConfirmDialog';
import { useExpenses } from '../../context/ExpensesContext';
import { useAuth } from '../../context/AuthContext';
import { useFriends } from '../../context/FriendsContext';
import type { CardMember } from '../../types/expenses';

/** Who has access to the focused card — the owner, then everyone who joined. Tap someone to send a friend request. */
export function MembersSheet() {
  const { membersOpen, closeMembers, focusedCard, membersFor } = useExpenses();
  const { user } = useAuth();
  const { relationshipWith, sendRequestToUser } = useFriends();
  const members = membersFor(focusedCard);
  const [selected, setSelected] = useState<CardMember | null>(null);
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
    <BottomSheet visible={membersOpen} onClose={closeMembers} maxHeightRatio={0.7}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Members</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          on {focusedCard?.label ?? ''}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {members.map((member) => {
          const initials = member.name.trim().slice(0, 2).toUpperCase() || '??';
          const isSelf = member.userId === user?.id;
          const row = (
            <View style={styles.row}>
              <View style={[styles.avatar, member.avatarUrl && styles.avatarPhoto]}>
                {member.avatarUrl ? <Image source={{ uri: member.avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.initials}>{initials}</Text>}
              </View>
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
    color: colors.walletSheetTextPrimary,
  },
  subtitle: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.walletSheetTextSecondary,
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
    backgroundColor: '#EBEBEB',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarPhoto: {
    overflow: 'hidden',
  },
  avatarImage: {
    width: 36,
    height: 36,
  },
  initials: {
    fontFamily: fontFamily.sans700,
    fontSize: 13,
    letterSpacing: 0.2,
    color: '#3D3D3D',
  },
  name: {
    flex: 1,
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: colors.walletSheetTextPrimary,
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.walletSheetMuted,
  },
  badgeOwner: {
    backgroundColor: '#111',
  },
  badgeLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 11.5,
    color: colors.walletSheetTextSecondary,
  },
  badgeLabelOwner: {
    color: '#fff',
  },
});
