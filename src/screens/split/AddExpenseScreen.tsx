import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, noOutline, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { useSplit } from '../../context/SplitContext';

const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';

const TITLE_PRESETS = ['Dinner', 'Stay', 'Travel', 'Drinks'];

type SplitMode = 'equal' | 'percentage' | 'custom';
const MODE_LABELS: { key: SplitMode; label: string }[] = [
  { key: 'equal', label: 'Equal' },
  { key: 'percentage', label: 'Percentage' },
  { key: 'custom', label: 'Exact' },
];

const KEY_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['00', '0', '⌫'],
];

const GRADIENT_PROPS = {
  colors: colors.splitGradient as [string, string, ...string[]],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

/** A pill that fills with the split gradient when active, plain white otherwise — used for both the quick-title and paid-by chips. */
function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  if (on) {
    return (
      <Pressable onPress={onPress} style={styles.pillShape}>
        <LinearGradient {...GRADIENT_PROPS} style={styles.pillFill}>
          <Text style={styles.pillLabelOn}>{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress} style={[styles.pillShape, styles.pillFill, styles.pillOff]}>
      <Text style={styles.pillLabel}>{label}</Text>
    </Pressable>
  );
}

/** Add an expense to the focused split — amount, who paid, and how it's shared. */
export function AddExpenseScreen() {
  const insets = useSafeAreaInsets();
  const { focusedGroup, membersFor, addExpense, goDashboard } = useSplit();
  const members = focusedGroup ? membersFor(focusedGroup.id) : [];

  const [amountStr, setAmountStr] = useState('');
  const [title, setTitle] = useState<string | null>(null);
  const [paidBy, setPaidBy] = useState(members[0]?.userId ?? '');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(members.map((m) => m.userId)));
  const [mode, setMode] = useState<SplitMode>('equal');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  // Members can finish loading (invite accepted, realtime membership fetch)
  // after this screen has already mounted with an empty/incomplete list —
  // keep paidBy and the default split-between selection in sync as they arrive.
  const memberKey = members.map((m) => m.userId).sort().join(',');
  useEffect(() => {
    if (members.length === 0) return;
    setPaidBy((prev) => (prev && members.some((m) => m.userId === prev) ? prev : members[0].userId));
    setSelected((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const m of members) {
        if (!next.has(m.userId)) {
          next.add(m.userId);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberKey]);

  const amount = Number(amountStr) || 0;
  const selectedIds = Array.from(selected);
  const equalShare = selectedIds.length > 0 ? amount / selectedIds.length : 0;

  const pressKey = (k: string) => {
    if (k === '⌫') {
      setAmountStr((s) => s.slice(0, -1));
      return;
    }
    setAmountStr((s) => (s + k).slice(0, 7));
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
  const modeLabel = MODE_LABELS.find((m) => m.key === mode)?.label ?? 'Equal';
  const shareNote =
    selectedIds.length === 0
      ? 'Pick at least one'
      : mode === 'equal'
        ? `Equal · ₹${Math.round(equalShare).toLocaleString('en-IN')} each`
        : `${modeLabel} · ₹${Math.round(assignedTotal).toLocaleString('en-IN')} of ₹${Math.round(amount).toLocaleString('en-IN')}`;

  const canSave = useMemo(() => {
    if (!title) return false;
    if (amount <= 0 || selectedIds.length === 0 || !paidBy) return false;
    if (mode !== 'equal' && Math.abs(assignedTotal - amount) > 0.5) return false;
    return true;
  }, [title, amount, selectedIds.length, paidBy, mode, assignedTotal]);

  const saveLabel = amount && title ? `Save ₹${Math.round(amount).toLocaleString('en-IN')} · ${title}` : 'Enter an amount';

  const save = () => {
    if (!canSave || !focusedGroup || !title) return;
    const shares = selectedIds.map((userId) => ({ userId, amount: Math.round(shareFor(userId) * 100) / 100 }));
    addExpense({ title, amount, category: title, paidBy, shares });
  };

  if (!focusedGroup) return null;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={goDashboard} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Close">
          <Icon path={CLOSE_ICON} color={colors.splitInk} size={19} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Add expense</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>AMOUNT</Text>
          <Text style={[styles.amount, !amount && styles.amountEmpty]}>₹{amount.toLocaleString('en-IN')}</Text>
        </View>

        <View style={styles.chipRow}>
          {TITLE_PRESETS.map((label) => (
            <Pill key={label} label={label} on={title === label} onPress={() => setTitle(label)} />
          ))}
        </View>

        <Text style={styles.label}>PAID BY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.payerRow}>
          {members.map((m) => (
            <Pill key={m.userId} label={m.name} on={paidBy === m.userId} onPress={() => setPaidBy(m.userId)} />
          ))}
        </ScrollView>

        <View style={styles.betweenHeader}>
          <Text style={styles.label}>SPLIT BETWEEN</Text>
          <Text style={styles.shareNote}>{shareNote}</Text>
        </View>
        <View style={styles.betweenRows}>
          {members.map((m) => {
            const on = selected.has(m.userId);
            return (
              <Pressable key={m.userId} onPress={() => toggleMember(m.userId)} style={[styles.betweenRow, !on && styles.betweenRowOff]}>
                {on ? (
                  <LinearGradient {...GRADIENT_PROPS} style={styles.checkbox}>
                    <Icon path="M5 12.5l4.5 4.5L19 7" color="#fff" size={13} strokeWidth={3} />
                  </LinearGradient>
                ) : (
                  <View style={[styles.checkbox, styles.checkboxOff]} />
                )}
                <Text style={styles.betweenName}>{m.name}</Text>
                {mode === 'equal' || !on ? (
                  <Text style={[styles.betweenShare, !on && styles.betweenShareOff]}>
                    {on ? `₹${Math.round(equalShare).toLocaleString('en-IN')}` : '—'}
                  </Text>
                ) : (
                  <TextInput
                    value={customValues[m.userId] ?? ''}
                    onChangeText={(v) => setCustomValues((prev) => ({ ...prev, [m.userId]: v.replace(/[^0-9.]/g, '') }))}
                    placeholder={mode === 'percentage' ? '%' : '₹'}
                    placeholderTextColor={colors.splitInkFaint45}
                    keyboardType="decimal-pad"
                    style={[styles.betweenInput, noOutline]}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>SPLIT</Text>
        <View style={styles.modeTabs}>
          {MODE_LABELS.map((m) => {
            const on = mode === m.key;
            if (on) {
              return (
                <Pressable key={m.key} onPress={() => setMode(m.key)} style={styles.modeTabShape}>
                  <LinearGradient {...GRADIENT_PROPS} style={styles.modeTabFill}>
                    <Text style={[styles.modeTabLabel, styles.modeTabLabelOn]}>{m.label}</Text>
                  </LinearGradient>
                </Pressable>
              );
            }
            return (
              <Pressable key={m.key} onPress={() => setMode(m.key)} style={[styles.modeTabShape, styles.modeTabFill]}>
                <Text style={styles.modeTabLabel}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View style={styles.keypad}>
          {KEY_ROWS.map((row, i) => (
            <View key={i} style={styles.keyRow}>
              {row.map((k) => (
                <Pressable key={k} onPress={() => pressKey(k)} style={styles.key}>
                  <Text style={[styles.keyLabel, k === '⌫' && styles.keyLabelFaint]}>{k}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
        <Pressable onPress={save} disabled={!canSave} style={[styles.saveButtonShape, !canSave && styles.saveButtonDisabled]}>
          <LinearGradient {...GRADIENT_PROPS} style={styles.saveButtonFill}>
            <Text style={styles.saveLabel}>{saveLabel}</Text>
          </LinearGradient>
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
    gap: 14,
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
    shadowColor: colors.splitInk,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  headerTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 21,
    letterSpacing: -0.2,
    color: colors.splitInk,
  },
  scroll: {
    paddingHorizontal: spacing.xxxl,
  },
  amountBlock: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    paddingBottom: 14,
  },
  amountLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    letterSpacing: 1.5,
    color: colors.splitInkFaint45,
  },
  amount: {
    fontFamily: fontFamily.sans700,
    fontSize: 44,
    letterSpacing: -1,
    color: colors.splitInk,
  },
  amountEmpty: {
    color: colors.splitInkFaint30,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pillShape: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  pillFill: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOff: {
    backgroundColor: colors.splitSurface,
    shadowColor: colors.splitInk,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 1,
  },
  pillLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: colors.splitInkFaint55,
  },
  pillLabelOn: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: '#fff',
  },
  label: {
    marginTop: 20,
    marginBottom: 8,
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    letterSpacing: 0.8,
    color: colors.splitInkFaint5,
  },
  payerRow: {
    gap: spacing.xs,
    paddingBottom: 4,
  },
  betweenHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 8,
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
    gap: 13,
    backgroundColor: colors.splitSurface,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  betweenRowOff: {
    opacity: 0.55,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOff: {
    backgroundColor: '#EDEDF3',
  },
  betweenName: {
    flex: 1,
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.splitInk,
  },
  betweenShare: {
    fontFamily: fontFamily.sans600,
    fontSize: 14,
    color: colors.splitInk,
  },
  betweenShareOff: {
    color: colors.splitInkFaint30,
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
  modeTabShape: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modeTabFill: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  modeTabLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.splitInkFaint5,
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
    gap: 6,
  },
  keyRow: {
    flexDirection: 'row',
    gap: 6,
  },
  key: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: colors.splitSurface,
    shadowColor: colors.splitInk,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 1,
  },
  keyLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 21,
    color: colors.splitInk,
  },
  keyLabelFaint: {
    color: colors.splitInkFaint45,
  },
  saveButtonShape: {
    marginTop: 10,
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: colors.splitAccent,
    shadowOpacity: 0.34,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 30,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonFill: {
    paddingVertical: 19,
    alignItems: 'center',
  },
  saveLabel: {
    fontFamily: fontFamily.sans700,
    fontSize: 16.5,
    color: '#fff',
  },
});
