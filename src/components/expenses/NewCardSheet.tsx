import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontFamily, noOutline, spacing } from '../../theme';
import { BottomSheet } from './BottomSheet';
import { useExpenses } from '../../context/ExpensesContext';
import { RESET_DAY_OPTIONS } from '../../data/expensesSeed';
import { daysInCurrentMonth, ordinalDay } from '../../utils/expensesFormat';

/** The "New budget card" sheet — name, reset day, budget amount. */
export function NewCardSheet() {
  const { newCardOpen, closeNewCard, addCard } = useExpenses();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [resetDay, setResetDay] = useState(RESET_DAY_OPTIONS[0]);
  const [customOpen, setCustomOpen] = useState(false);
  const [calMonthOffset, setCalMonthOffset] = useState(0);

  useEffect(() => {
    if (newCardOpen) {
      setName('');
      setAmount('');
      setResetDay(RESET_DAY_OPTIONS[0]);
      setCustomOpen(false);
      setCalMonthOffset(0);
    }
  }, [newCardOpen]);

  const amountNum = Number(amount || 0);
  const valid = name.trim().length > 0 && amount.trim().length > 0 && amountNum >= 0;

  const submit = () => {
    if (!valid) return;
    addCard({ name, amount: amountNum, resetDay });
  };

  const now = new Date();
  const calMonth = new Date(now.getFullYear(), now.getMonth() + calMonthOffset, 1);
  const days = daysInCurrentMonth(calMonth);
  const calMonthLabel = calMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <BottomSheet visible={newCardOpen} onClose={closeNewCard}>
      <Text style={styles.title}>New budget card</Text>

      <View style={{ gap: spacing.xs }}>
        <Text style={styles.label}>Budget name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Weekend fund"
          placeholderTextColor={colors.walletSheetTextFaint}
          style={[styles.textField, noOutline]}
        />
      </View>

      <View style={{ gap: spacing.xs }}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Resets on</Text>
          <Text style={styles.dateValue}>{resetDay} of every month</Text>
        </View>
        <View style={styles.dayRow}>
          {RESET_DAY_OPTIONS.map((d) => {
            const on = d === 'Custom' ? customOpen : d === resetDay;
            return (
              <Pressable
                key={d}
                onPress={() => {
                  if (d === 'Custom') {
                    setCustomOpen((v) => !v);
                  } else {
                    setResetDay(d);
                    setCustomOpen(false);
                  }
                }}
                style={[styles.dayPill, on && styles.dayPillOn]}
              >
                <Text style={[styles.dayPillLabel, on && styles.dayPillLabelOn]}>{d}</Text>
              </Pressable>
            );
          })}
        </View>

        {customOpen && (
          <View style={styles.calGrid}>
            <View style={styles.calHeader}>
              <Pressable
                onPress={() => setCalMonthOffset((v) => Math.max(0, v - 1))}
                disabled={calMonthOffset === 0}
                style={[styles.calNavButton, calMonthOffset === 0 && styles.calNavButtonDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
              >
                <Text style={[styles.calNavLabel, calMonthOffset === 0 && styles.calNavLabelDisabled]}>‹</Text>
              </Pressable>
              <Text style={styles.calMonthLabel}>{calMonthLabel}</Text>
              <Pressable
                onPress={() => setCalMonthOffset((v) => v + 1)}
                style={styles.calNavButton}
                accessibilityRole="button"
                accessibilityLabel="Next month"
              >
                <Text style={styles.calNavLabel}>›</Text>
              </Pressable>
            </View>
            <View style={styles.calDaysWrap}>
            {Array.from({ length: days }, (_, k) => {
              const label = ordinalDay(k + 1);
              const on = resetDay === label;
              return (
                <Pressable
                  key={k}
                  onPress={() => {
                    setResetDay(label);
                    setCustomOpen(false);
                  }}
                  style={[styles.calDay, on && styles.calDayOn]}
                >
                  <Text style={[styles.calDayLabel, on && styles.calDayLabelOn]}>{k + 1}</Text>
                </Pressable>
              );
            })}
            </View>
          </View>
        )}
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text style={styles.label}>Budget amount</Text>
        <View style={styles.amountField}>
          <Text style={styles.amountPrefix}>₹</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
            placeholder="1000"
            placeholderTextColor={colors.walletSheetTextFaint}
            keyboardType="decimal-pad"
            style={[styles.amountInput, noOutline]}
          />
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable onPress={closeNewCard} style={styles.cancelButton}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
        <Pressable onPress={submit} style={[styles.saveButton, { backgroundColor: valid ? colors.walletAccentBlue : 'rgba(22,104,232,.4)' }]}>
          <Text style={styles.saveLabel}>Create card</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 21,
    color: colors.walletSheetTextPrimary,
  },
  label: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.walletSheetTextSecondary,
  },
  textField: {
    borderWidth: 1,
    borderColor: colors.walletSheetBorder,
    backgroundColor: colors.walletSheetFaint,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: fontFamily.sans500,
    fontSize: 15,
    color: colors.walletSheetTextPrimary,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  dateValue: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.walletSheetTextPrimary,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dayPill: {
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 15,
    backgroundColor: colors.walletSheetMuted,
    borderWidth: 1,
    borderColor: colors.walletSheetBorder,
  },
  dayPillOn: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  dayPillLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 13,
    color: colors.walletSheetTextSecondary,
  },
  dayPillLabelOn: {
    fontFamily: fontFamily.sans600,
    color: '#fff',
  },
  calGrid: {
    gap: 10,
    backgroundColor: colors.walletSheetMuted,
    borderRadius: 16,
    padding: 11,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calMonthLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    color: colors.walletSheetTextPrimary,
  },
  calNavButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.walletSheetBorder,
  },
  calNavButtonDisabled: {
    opacity: 0.35,
  },
  calNavLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.walletSheetTextPrimary,
  },
  calNavLabelDisabled: {
    color: colors.walletSheetTextFaint,
  },
  calDaysWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  calDay: {
    width: 38,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.walletSheetBorder,
  },
  calDayOn: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  calDayLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: 'rgba(0,0,0,.62)',
  },
  calDayLabelOn: {
    fontFamily: fontFamily.sans600,
    color: '#fff',
  },
  amountField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
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
