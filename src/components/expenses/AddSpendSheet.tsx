import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontFamily, noOutline, spacing } from '../../theme';
import { BottomSheet } from './BottomSheet';
import { useExpenses } from '../../context/ExpensesContext';
import { SPEND_CATEGORIES } from '../../data/expenseCategories';
import { daysInCurrentMonth, relativeDateLabel } from '../../utils/expensesFormat';

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

/** The "Add spend" sheet — title, amount, category chips, date picker. */
export function AddSpendSheet() {
  const { spendOpen, closeSpend, addExpense, focusedCard } = useExpenses();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(SPEND_CATEGORIES[0].label);
  const [date, setDate] = useState(() => new Date());
  const [calOpen, setCalOpen] = useState(false);

  useEffect(() => {
    if (spendOpen) {
      setTitle('');
      setAmount('');
      setCategory(SPEND_CATEGORIES[0].label);
      setDate(new Date());
      setCalOpen(false);
    }
  }, [spendOpen]);

  const yesterday = new Date(Date.now() - 86400000);
  const amountNum = Number(amount || 0);
  const valid = title.trim().length > 0 && amountNum > 0;

  const submit = () => {
    if (!valid) return;
    addExpense({ title, amount: amountNum, category, date });
  };

  const now = new Date();
  const days = daysInCurrentMonth(now);

  return (
    <BottomSheet visible={spendOpen} onClose={closeSpend}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Add spend</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          on {focusedCard?.label ?? ''}
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="What was it?"
          placeholderTextColor={colors.walletSheetTextFaint}
          style={[styles.textField, noOutline]}
        />
        <View style={styles.amountField}>
          <Text style={styles.amountPrefix}>₹</Text>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            placeholderTextColor={colors.walletSheetTextFaint}
            keyboardType="decimal-pad"
            style={[styles.amountInput, noOutline]}
          />
        </View>
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text style={styles.label}>Category</Text>
        <View style={styles.chipRow}>
          {SPEND_CATEGORIES.map((cat) => {
            const on = category === cat.label;
            return (
              <Pressable key={cat.label} onPress={() => setCategory(cat.label)} style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{cat.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: spacing.xs }}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.dateValue}>{calOpen ? 'Pick date' : relativeDateLabel(date, now)}</Text>
        </View>
        <View style={styles.dateRow}>
          <Pressable
            onPress={() => {
              setDate(now);
              setCalOpen(false);
            }}
            style={[styles.datePill, !calOpen && sameDay(date, now) && styles.datePillOn]}
          >
            <Text style={[styles.datePillLabel, !calOpen && sameDay(date, now) && styles.datePillLabelOn]}>Today</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setDate(yesterday);
              setCalOpen(false);
            }}
            style={[styles.datePill, !calOpen && sameDay(date, yesterday) && styles.datePillOn]}
          >
            <Text style={[styles.datePillLabel, !calOpen && sameDay(date, yesterday) && styles.datePillLabelOn]}>
              Yesterday
            </Text>
          </Pressable>
          <Pressable onPress={() => setCalOpen((v) => !v)} style={[styles.datePill, calOpen && styles.datePillOn]}>
            <Text style={[styles.datePillLabel, calOpen && styles.datePillLabelOn]}>Pick date</Text>
          </Pressable>
        </View>

        {calOpen && (
          <View style={styles.calGrid}>
            {Array.from({ length: days }, (_, k) => {
              const d = new Date(now.getFullYear(), now.getMonth(), k + 1);
              const on = sameDay(date, d);
              return (
                <Pressable
                  key={k}
                  onPress={() => {
                    setDate(d);
                    setCalOpen(false);
                  }}
                  style={[styles.calDay, on && styles.calDayOn]}
                >
                  <Text style={[styles.calDayLabel, on && styles.calDayLabelOn]}>{k + 1}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.actionsRow}>
        <Pressable onPress={closeSpend} style={styles.cancelButton}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
        <Pressable onPress={submit} style={[styles.saveButton, { backgroundColor: valid ? colors.walletAccentBlue : 'rgba(22,104,232,.4)' }]}>
          <Text style={styles.saveLabel}>Add spend</Text>
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
  textField: {
    borderWidth: 1,
    borderColor: colors.walletSheetBorder,
    backgroundColor: colors.walletSheetFaint,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: fontFamily.sans500,
    fontSize: 14.5,
    color: colors.walletSheetTextPrimary,
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
  label: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.walletSheetTextSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 13,
    backgroundColor: colors.walletSheetMuted,
    borderWidth: 1,
    borderColor: colors.walletSheetBorder,
  },
  chipOn: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  chipLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.walletSheetTextSecondary,
  },
  chipLabelOn: {
    fontFamily: fontFamily.sans600,
    color: '#fff',
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
  dateRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  datePill: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.walletSheetMuted,
    borderWidth: 1,
    borderColor: colors.walletSheetBorder,
  },
  datePillOn: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  datePillLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.walletSheetTextSecondary,
  },
  datePillLabelOn: {
    fontFamily: fontFamily.sans600,
    color: '#fff',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: colors.walletSheetMuted,
    borderRadius: 16,
    padding: 11,
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
