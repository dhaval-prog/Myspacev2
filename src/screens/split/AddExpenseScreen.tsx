import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, noOutline, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { MemberAvatar } from '../../components/split/MemberAvatar';
import { useSplit } from '../../context/SplitContext';
import { SPEND_CATEGORIES } from '../../data/expenseCategories';

const BACK_ICON = 'M6 6l12 12M18 6L6 18';
const CHECK_ICON = 'M5 12.5l4.5 4.5L19 7';

const TITLE_PRESETS = [SPEND_CATEGORIES[0], SPEND_CATEGORIES[6], SPEND_CATEGORIES[3], SPEND_CATEGORIES[7]]; // Groceries, Food, Personal (cab-ish), Other

type SplitMode = 'equal' | 'percentage' | 'custom';
const MODE_LABELS: { key: SplitMode; label: string }[] = [
  { key: 'equal', label: 'Equally' },
  { key: 'percentage', label: 'Percentage' },
  { key: 'custom', label: 'Custom' },
];

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

/** Add an expense to the focused split — amount, who paid, and how it's shared. */
export function AddExpenseScreen() {
  const insets = useSafeAreaInsets();
  const { focusedGroup, membersFor, addExpense, goDashboard } = useSplit();
  const members = focusedGroup ? membersFor(focusedGroup.id) : [];

  const [amountStr, setAmountStr] = useState('0');
  const [titleIdx, setTitleIdx] = useState<number | null>(null);
  const [paidBy, setPaidBy] = useState(members[0]?.userId ?? '');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(members.map((m) => m.userId)));
  const [mode, setMode] = useState<SplitMode>('equal');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const amount = Number(amountStr) || 0;
  const selectedIds = Array.from(selected);
  const equalShare = selectedIds.length > 0 ? amount / selectedIds.length : 0;

  const pressKey = (k: string) => {
    if (k === '⌫') {
      setAmountStr((s) => (s.length <= 1 ? '0' : s.slice(0, -1)));
      return;
    }
    if (k === '.' && amountStr.includes('.')) return;
    setAmountStr((s) => {
      if (s === '0' && k !== '.') return k;
      if (s.length > 9) return s;
      return s + k;
    });
  };

  const toggleMember = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const shareFor = (userId: string): number => {
    if (mode === 'equal') return equalShare;
    if (mode === 'percentage') return (amount * (Number(customValues[userId]) || 0)) / 100;
    return Number(customValues[userId]) || 0;
  };

  const assignedTotal = selectedIds.reduce((s, id) => s + shareFor(id), 0);
  const shareNote = mode === 'equal' ? `₹${Math.round(equalShare).toLocaleString('en-IN')} each` : `₹${Math.round(assignedTotal).toLocaleString('en-IN')} of ₹${Math.round(amount).toLocaleString('en-IN')}`;

  const canSave = useMemo(() => {
    if (!titleIdx && titleIdx !== 0) return false;
    if (amount <= 0 || selectedIds.length === 0 || !paidBy) return false;
    if (mode !== 'equal' && Math.abs(assignedTotal - amount) > 0.5) return false;
    return true;
  }, [titleIdx, amount, selectedIds.length, paidBy, mode, assignedTotal]);

  const save = () => {
    if (!canSave || !focusedGroup) return;
    const shares = selectedIds.map((userId) => ({ userId, amount: Math.round(shareFor(userId) * 100) / 100 }));
    addExpense({
      title: titleIdx !== null ? TITLE_PRESETS[titleIdx].label : 'Expense',
      amount,
      category: titleIdx !== null ? TITLE_PRESETS[titleIdx].label : '',
      paidBy,
      shares,
    });
  };

  if (!focusedGroup) return null;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={goDashboard} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Close">
          <Icon path={BACK_ICON} color={colors.splitInk} size={19} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Add expense</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>AMOUNT</Text>
          <Text style={styles.amount}>₹{amount.toLocaleString('en-IN')}</Text>
        </View>

        <View style={styles.chipRow}>
          {TITLE_PRESETS.map((t, i) => {
            const on = titleIdx === i;
            return (
              <Pressable key={t.label} onPress={() => setTitleIdx(i)} style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>PAID BY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.payerRow}>
          {members.map((m) => {
            const on = paidBy === m.userId;
            return (
              <Pressable key={m.userId} onPress={() => setPaidBy(m.userId)} style={[styles.payerChip, on && styles.payerChipOn]}>
                <Text style={[styles.payerChipLabel, on && styles.payerChipLabelOn]}>{m.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.betweenHeader}>
          <Text style={styles.label}>SPLIT BETWEEN</Text>
          <Text style={styles.shareNote}>{shareNote}</Text>
        </View>
        <View style={styles.betweenRows}>
          {members.map((m) => {
            const on = selected.has(m.userId);
            return (
              <View key={m.userId} style={[styles.betweenRow, !on && styles.betweenRowOff]}>
                <Pressable onPress={() => toggleMember(m.userId)} style={styles.betweenRowMain}>
                  <View style={[styles.checkbox, on && styles.checkboxOn]}>
                    {on && <Icon path={CHECK_ICON} color="#fff" size={13} strokeWidth={3} />}
                  </View>
                  <Text style={styles.betweenName}>{m.name}</Text>
                </Pressable>
                {on && mode === 'equal' && <Text style={styles.betweenShare}>₹{Math.round(equalShare).toLocaleString('en-IN')}</Text>}
                {on && mode !== 'equal' && (
                  <TextInput
                    value={customValues[m.userId] ?? ''}
                    onChangeText={(v) => setCustomValues((prev) => ({ ...prev, [m.userId]: v.replace(/[^0-9.]/g, '') }))}
                    placeholder={mode === 'percentage' ? '%' : '₹'}
                    placeholderTextColor={colors.splitInkFaint45}
                    keyboardType="decimal-pad"
                    style={[styles.betweenInput, noOutline]}
                  />
                )}
              </View>
            );
          })}
        </View>

        <Text style={styles.label}>SPLIT</Text>
        <View style={styles.modeTabs}>
          {MODE_LABELS.map((m) => {
            const on = mode === m.key;
            return (
              <Pressable key={m.key} onPress={() => setMode(m.key)} style={[styles.modeTab, on && styles.modeTabOn]}>
                <Text style={[styles.modeTabLabel, on && styles.modeTabLabelOn]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View style={styles.keypad}>
          {KEYS.map((k) => (
            <Pressable key={k} onPress={() => pressKey(k)} style={styles.key}>
              <Text style={styles.keyLabel}>{k}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={save} disabled={!canSave} style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}>
          <Text style={styles.saveLabel}>Save expense</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.splitBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: spacing.xxxl,
    paddingBottom: spacing.md,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.splitSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 21,
    letterSpacing: -0.2,
    color: colors.splitInk,
  },
  scroll: {
    paddingHorizontal: spacing.xxxl,
    gap: spacing.ms,
  },
  amountBlock: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
  },
  amountLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    letterSpacing: 1.5,
    color: colors.splitInkFaint45,
  },
  amount: {
    fontFamily: fontFamily.sans700,
    fontSize: 40,
    letterSpacing: -1,
    color: colors.splitInk,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: colors.splitSurface,
  },
  chipOn: {
    backgroundColor: colors.splitInk,
  },
  chipLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    color: colors.splitInk,
  },
  chipLabelOn: {
    color: '#fff',
  },
  label: {
    marginTop: spacing.md,
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    letterSpacing: 0.8,
    color: colors.splitInkFaint5,
  },
  payerRow: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  payerChip: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.splitSurface,
  },
  payerChipOn: {
    backgroundColor: colors.splitInk,
  },
  payerChipLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: colors.splitInk,
  },
  payerChipLabelOn: {
    color: '#fff',
  },
  betweenHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  shareNote: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.splitAccent,
  },
  betweenRows: {
    gap: 6,
  },
  betweenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: colors.splitSurface,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  betweenRowOff: {
    opacity: 0.55,
  },
  betweenRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.splitInkFaint30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.splitAccent,
    borderColor: colors.splitAccent,
  },
  betweenName: {
    flex: 1,
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.splitInk,
  },
  betweenShare: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: colors.splitInkFaint6,
  },
  betweenInput: {
    width: 64,
    textAlign: 'right',
    fontFamily: fontFamily.sans600,
    fontSize: 14,
    color: colors.splitInk,
    paddingVertical: 4,
  },
  modeTabs: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.splitSurface,
    borderRadius: 16,
    padding: 5,
  },
  modeTab: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeTabOn: {
    backgroundColor: colors.splitInk,
  },
  modeTabLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.splitInkFaint6,
  },
  modeTabLabelOn: {
    color: '#fff',
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xs,
    backgroundColor: colors.splitBg,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  key: {
    width: '33.333%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  keyLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 21,
    color: colors.splitInk,
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: colors.splitAccent,
    paddingVertical: 19,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: 'rgba(250,46,110,.4)',
  },
  saveLabel: {
    fontFamily: fontFamily.sans700,
    fontSize: 16.5,
    color: '#fff',
  },
});
