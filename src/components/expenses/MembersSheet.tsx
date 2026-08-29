import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '../../theme';
import { BottomSheet } from './BottomSheet';
import { useExpenses } from '../../context/ExpensesContext';

/** Who has access to the focused card — the owner, then everyone who joined. */
export function MembersSheet() {
  const { membersOpen, closeMembers, focusedCard, membersFor } = useExpenses();
  const members = membersFor(focusedCard);

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
          return (
            <View key={member.userId} style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.initials}>{initials}</Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {member.name}
              </Text>
              <View style={[styles.badge, member.isOwner && styles.badgeOwner]}>
                <Text style={[styles.badgeLabel, member.isOwner && styles.badgeLabelOwner]}>{member.isOwner ? 'Owner' : 'Member'}</Text>
              </View>
            </View>
          );
        })}
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
