import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '../../theme';
import { BottomSheet } from './BottomSheet';
import { ExpenseRow } from './ExpenseRow';
import { MemberSpendBar } from './MemberSpendBar';
import { useExpenses } from '../../context/ExpensesContext';
import { parseAmount } from '../../utils/expensesFormat';

/** Full spend history for the focused card. */
export function HistorySheet() {
  const { historyOpen, closeHistory, focusedCard, expensesFor, historyFor, memberSpendsFor } = useExpenses();
  const expenses = expensesFor(focusedCard);
  const history = historyFor(focusedCard);
  const total = expenses.reduce((s, x) => s + parseAmount(x.amt), 0);
  const members = memberSpendsFor(focusedCard);
  const maxMemberTotal = Math.max(0, ...members.map((m) => m.total));

  return (
    <BottomSheet visible={historyOpen} onClose={closeHistory} maxHeightRatio={0.76}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          on {focusedCard?.label ?? ''}
        </Text>
      </View>

      {members.length > 0 && (
        <View style={styles.members}>
          {members.map((member) => (
            <MemberSpendBar key={member.userId} member={member} maxTotal={maxMemberTotal} />
          ))}
        </View>
      )}

      <View style={styles.summary}>
        <Text style={styles.summaryCount}>
          {expenses.length} {expenses.length === 1 ? 'spend' : 'spends'} on this card
        </Text>
        <Text style={styles.summaryTotal}>-₹{Math.round(total).toLocaleString('en-IN')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {history.length === 0 ? (
          <Text style={styles.emptyText}>Nothing on this card yet.{'\n'}Spends and Add Money show up here.</Text>
        ) : (
          history.map((expense, i) => <ExpenseRow key={`${expense.title}-${i}`} expense={expense} />)
        )}
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
  members: {
    gap: spacing.ms,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.walletSheetMuted,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  summaryCount: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.walletSheetTextSecondary,
  },
  summaryTotal: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.walletSheetTextPrimary,
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  emptyText: {
    marginTop: spacing.xxl,
    textAlign: 'center',
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.walletSheetTextFaint,
  },
});
