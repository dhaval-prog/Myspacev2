import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../Icon';
import type { Expense } from '../../types/expenses';

const CHECK_ICON = 'M5 12.5l4.5 4.5L19 7';

interface ExpenseRowProps {
  expense: Expense;
  /** When set, renders a checkbox and makes the whole row tappable — used by Transfer Expenses' multi-select. */
  selection?: { checked: boolean; onToggle: () => void };
}

export function ExpenseRow({ expense, selection }: ExpenseRowProps) {
  const row = (
    <View style={styles.row}>
      {selection &&
        (selection.checked ? (
          <View style={[styles.checkbox, styles.checkboxOn]}>
            <Icon path={CHECK_ICON} color="#fff" size={13} strokeWidth={3} />
          </View>
        ) : (
          <View style={[styles.checkbox, styles.checkboxOff]} />
        ))}
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

  if (!selection) return row;
  return (
    <Pressable onPress={selection.onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: selection.checked }} accessibilityLabel={expense.title}>
      {row}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxOn: {
    backgroundColor: colors.walletAccentBlue,
  },
  checkboxOff: {
    backgroundColor: '#EDEDF3',
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
