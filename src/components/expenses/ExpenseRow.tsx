import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../Icon';
import type { Expense } from '../../types/expenses';

export function ExpenseRow({ expense }: { expense: Expense }) {
  return (
    <View style={styles.row}>
      <View style={[styles.tile, { backgroundColor: expense.tile }]}>
        <Icon path={expense.icon} color={colors.walletSheetTextPrimary} size={20} strokeWidth={1.7} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>{expense.title}</Text>
        <Text style={styles.date}>{expense.date}</Text>
      </View>
      <Text style={[styles.amount, expense.amt.startsWith('+') && { color: colors.walletAccentBlue }]}>
        {expense.amt}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
  tile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: colors.walletSheetTextPrimary,
  },
  date: {
    fontFamily: fontFamily.sans400,
    fontSize: 11.5,
    color: colors.walletSheetTextFaint,
  },
  amount: {
    fontFamily: fontFamily.sans600,
    fontSize: 14,
    color: colors.walletSheetTextPrimary,
  },
});
