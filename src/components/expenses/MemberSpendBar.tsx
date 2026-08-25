import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '../../theme';
import { CARD_PALETTE } from '../../data/expensesSeed';
import type { MemberSpend } from '../../types/expenses';

/** Deterministic so the same member always gets the same chip color across renders. */
function paletteFor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return CARD_PALETTE[hash % CARD_PALETTE.length];
}

/** One row of the History sheet's per-member breakdown: initials chip, name, total, and a share-of-spend bar. */
export function MemberSpendBar({ member, maxTotal }: { member: MemberSpend; maxTotal: number }) {
  const skin = paletteFor(member.userId);
  const initials = member.name.trim().slice(0, 2).toUpperCase() || '??';
  const pct = maxTotal > 0 ? Math.max(6, Math.round((member.total / maxTotal) * 100)) : 0;

  return (
    <View style={styles.row}>
      <View style={styles.topRow}>
        <View style={[styles.avatar, { backgroundColor: skin.bg }]}>
          <Text style={[styles.initials, { color: skin.ink }]}>{initials}</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {member.name}
        </Text>
        <Text style={styles.amount}>₹{Math.round(member.total).toLocaleString('en-IN')}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  initials: {
    fontFamily: fontFamily.sans700,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  name: {
    flex: 1,
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    color: colors.walletSheetTextPrimary,
  },
  amount: {
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    color: colors.walletSheetTextSecondary,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.walletSheetMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#3D3D3D',
  },
});
