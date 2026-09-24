import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '../../theme';
import { BottomSheet } from './BottomSheet';
import { ConfirmDialog } from '../ConfirmDialog';
import { useExpenses } from '../../context/ExpensesContext';

/** Picks which other card the selected spends get duplicated onto, for Transfer Expenses. */
export function TransferCardPickerSheet() {
  const {
    deck,
    focusedCard,
    selectedExpenseIds,
    transferSheetOpen,
    closeTransferSheet,
    transferring,
    confirmTransfer,
    transferDone,
    dismissTransferDone,
    transferError,
    dismissTransferError,
  } = useExpenses();

  const otherCards = deck.filter((c) => c.id !== focusedCard?.id);
  const expenseCount = selectedExpenseIds.size;

  return (
    <>
      <BottomSheet visible={transferSheetOpen} onClose={closeTransferSheet} maxHeightRatio={0.7}>
        <Text style={styles.title}>Transfer to which card?</Text>
        <Text style={styles.subtitle}>
          {expenseCount} {expenseCount === 1 ? 'expense' : 'expenses'} will be duplicated onto the card you pick.
        </Text>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {otherCards.length === 0 ? (
            <Text style={styles.empty}>You don't have another card yet — create one first.</Text>
          ) : (
            otherCards.map((card) => (
              <Pressable
                key={card.id}
                onPress={() => confirmTransfer(card.id)}
                disabled={transferring}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed, transferring && styles.rowDisabled]}
                accessibilityRole="button"
                accessibilityLabel={`Transfer to ${card.label}`}
              >
                <View style={[styles.tile, { backgroundColor: card.bg }]}>
                  <Text style={[styles.tileLabel, { color: card.ink }]} numberOfLines={1}>
                    {card.label.trim().slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.textCol}>
                  <Text style={styles.name} numberOfLines={1}>
                    {card.label}
                  </Text>
                  <Text style={styles.meta}>{card.amount}</Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </BottomSheet>

      <ConfirmDialog
        visible={transferDone}
        title="Expenses transferred"
        message="The selected expenses were duplicated onto that card."
        confirmLabel="OK"
        hideCancel
        onConfirm={dismissTransferDone}
        onCancel={dismissTransferDone}
      />
      <ConfirmDialog
        visible={!!transferError}
        title="Couldn't transfer expenses"
        message={transferError ?? ''}
        confirmLabel="OK"
        hideCancel
        onConfirm={dismissTransferError}
        onCancel={dismissTransferError}
      />
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 21,
    color: colors.walletSheetTextPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.walletSheetTextSecondary,
  },
  list: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  empty: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    color: colors.walletSheetTextFaint,
    paddingVertical: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.walletSheetFaint,
    borderRadius: 20,
    padding: spacing.md,
  },
  rowPressed: {
    opacity: 0.88,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  tile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontFamily: fontFamily.sans700,
    fontSize: 12.5,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.walletSheetTextPrimary,
  },
  meta: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.walletSheetTextFaint,
  },
});
