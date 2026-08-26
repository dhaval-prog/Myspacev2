import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontFamily, noOutline, spacing } from '../../theme';
import { BottomSheet } from './BottomSheet';
import { useExpenses } from '../../context/ExpensesContext';

/** The "Add money" sheet — just an amount, topped up onto the focused card's budget. */
export function AddMoneySheet() {
  const { addMoneyOpen, closeAddMoney, addMoney, focusedCard } = useExpenses();
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (addMoneyOpen) setAmount('');
  }, [addMoneyOpen]);

  const amountNum = Number(amount || 0);
  const valid = amountNum > 0;

  const submit = () => {
    if (!valid) return;
    addMoney(amountNum);
  };

  return (
    <BottomSheet visible={addMoneyOpen} onClose={closeAddMoney}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Add money</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          to {focusedCard?.label ?? ''}
        </Text>
      </View>

      <View style={styles.amountField}>
        <Text style={styles.amountPrefix}>₹</Text>
        <TextInput
          value={amount}
          onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
          placeholder="0"
          placeholderTextColor={colors.walletSheetTextFaint}
          keyboardType="decimal-pad"
          autoFocus
          style={[styles.amountInput, noOutline]}
        />
      </View>

      <View style={styles.actionsRow}>
        <Pressable onPress={closeAddMoney} style={styles.cancelButton}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
        <Pressable onPress={submit} style={[styles.saveButton, { backgroundColor: valid ? colors.walletAccentBlue : 'rgba(22,104,232,.4)' }]}>
          <Text style={styles.saveLabel}>Add money</Text>
        </Pressable>
      </View>
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
  amountField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.walletSheetBorder,
    backgroundColor: colors.walletSheetFaint,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  amountPrefix: {
    fontFamily: fontFamily.mono500,
    fontSize: 16,
    color: colors.walletSheetTextFaint,
  },
  amountInput: {
    flex: 1,
    fontFamily: fontFamily.mono500,
    fontSize: 16,
    color: colors.walletSheetTextPrimary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,.06)',
  },
  cancelLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: colors.walletSheetTextPrimary,
  },
  saveButton: {
    flex: 1.4,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: '#fff',
  },
});
