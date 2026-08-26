import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, noOutline, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { initialsOf } from '../../components/split/MemberAvatar';
import { useSplit } from '../../context/SplitContext';
import { SPLIT_EXPENSE_CATEGORIES } from '../../data/splitExpenseCategories';

const BACK_ICON = 'M15 5l-7 7 7 7';
const PLUS_ICON = 'M12 6v12M6 12h12';

const GRADIENT_PROPS = {
  colors: colors.splitGradient as [string, string, ...string[]],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

const CATEGORY_LABELS = SPLIT_EXPENSE_CATEGORIES.map((c) => c.label);

interface Line {
  id: string;
  name: string;
  amount: string;
  assigned: Set<string>;
}

/** Line-by-line "Smart Split" — pick which expense category this bill falls under, then assign each line to whoever shares it. */
export function ItemSplitScreen() {
  const insets = useSafeAreaInsets();
  const { focusedGroup, membersFor, addItemizedExpense, goDashboard } = useSplit();
  const members = focusedGroup ? membersFor(focusedGroup.id) : [];
  const allIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);

  const [category, setCategory] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([{ id: 'l1', name: '', amount: '', assigned: new Set(allIds) }]);

  const addLine = () => setLines((prev) => [...prev, { id: `l${prev.length + 1}-${Date.now()}`, name: '', amount: '', assigned: new Set(allIds) }]);

  const updateLine = (id: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const toggleAssign = (lineId: string, userId: string) =>
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const next = new Set(l.assigned);
        if (next.has(userId)) next.delete(userId);
        else next.add(userId);
        return { ...l, assigned: next };
      }),
    );

  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const shareRows = useMemo(() => {
    const totals = new Map<string, number>();
    for (const l of lines) {
      const amt = Number(l.amount) || 0;
      if (amt <= 0 || l.assigned.size === 0) continue;
      const each = amt / l.assigned.size;
      for (const uid of l.assigned) totals.set(uid, (totals.get(uid) ?? 0) + each);
    }
    return members
      .map((m) => ({ ...m, amount: totals.get(m.userId) ?? 0 }))
      .filter((r) => r.amount > 0.01)
      .sort((a, b) => b.amount - a.amount);
  }, [lines, members]);

  const maxShare = Math.max(1, ...shareRows.map((r) => r.amount));
  const canSave = Boolean(category) && total > 0 && lines.some((l) => (Number(l.amount) || 0) > 0 && l.assigned.size > 0);

  const save = () => {
    if (!canSave || !focusedGroup || !category) return;
    addItemizedExpense({
      paidBy: members[0]?.userId ?? '',
      category,
      lines: lines
        .filter((l) => (Number(l.amount) || 0) > 0 && l.assigned.size > 0)
        .map((l) => ({ name: l.name.trim() || 'Item', amount: Number(l.amount), assignedUserIds: Array.from(l.assigned) })),
    });
  };

  if (!focusedGroup) return null;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={goDashboard} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color={colors.splitInk} size={19} strokeWidth={2} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Smart Split</Text>
          <Text style={styles.headerMeta}>
            {category ? `${category} · ` : ''}₹{Math.round(total).toLocaleString('en-IN')} · assign each line
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.categoryRow}>
          {CATEGORY_LABELS.map((label) => {
            const on = category === label;
            if (on) {
              return (
                <Pressable key={label} onPress={() => setCategory(label)} style={styles.categoryPillShape}>
                  <LinearGradient {...GRADIENT_PROPS} style={styles.categoryPillFill}>
                    <Text style={[styles.categoryPillLabel, styles.categoryPillLabelOn]}>{label}</Text>
                  </LinearGradient>
                </Pressable>
              );
            }
            return (
              <Pressable key={label} onPress={() => setCategory(label)} style={[styles.categoryPillShape, styles.categoryPillFill, styles.categoryPillOff]}>
                <Text style={styles.categoryPillLabel}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.lines}>
          {lines.map((line) => (
            <View key={line.id} style={styles.lineCard}>
              <View style={styles.lineTopRow}>
                <TextInput
                  value={line.name}
                  onChangeText={(v) => updateLine(line.id, { name: v })}
                  placeholder="Item name"
                  placeholderTextColor={colors.splitInkFaint45}
                  style={[styles.lineNameInput, noOutline]}
                />
                <TextInput
                  value={line.amount}
                  onChangeText={(v) => updateLine(line.id, { amount: v.replace(/[^0-9.]/g, '') })}
                  placeholder="₹0"
                  placeholderTextColor={colors.splitInkFaint45}
                  keyboardType="decimal-pad"
                  style={[styles.lineAmountInput, noOutline]}
                />
              </View>
              <View style={styles.lineAssignRow}>
                {members.map((m) => {
                  const on = line.assigned.has(m.userId);
                  if (on) {
                    return (
                      <Pressable key={m.userId} onPress={() => toggleAssign(line.id, m.userId)} style={styles.lineChipShape}>
                        <LinearGradient {...GRADIENT_PROPS} style={styles.lineChipFill}>
                          <Text style={[styles.lineChipLabel, styles.lineChipLabelOn]}>{initialsOf(m.name)}</Text>
                        </LinearGradient>
                      </Pressable>
                    );
                  }
                  return (
                    <Pressable
                      key={m.userId}
                      onPress={() => toggleAssign(line.id, m.userId)}
                      style={[styles.lineChipShape, styles.lineChipFill, styles.lineChipOff]}
                    >
                      <Text style={styles.lineChipLabel}>{initialsOf(m.name)}</Text>
                    </Pressable>
                  );
                })}
                <Text style={[styles.lineEach, line.assigned.size === 0 && styles.lineEachEmpty]}>
                  {line.assigned.size > 0
                    ? `₹${Math.round((Number(line.amount) || 0) / line.assigned.size).toLocaleString('en-IN')} each`
                    : 'unassigned'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable onPress={addLine} style={styles.addLineButton}>
          <Icon path={PLUS_ICON} color={colors.splitAccent} size={16} strokeWidth={2.2} />
          <Text style={styles.addLineLabel}>Add line</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Everyone owes</Text>
        <View style={styles.shareRows}>
          {shareRows.length === 0 ? (
            <Text style={styles.emptyNote}>Add a line and assign it to see who owes what.</Text>
          ) : (
            shareRows.map((r) => (
              <View key={r.userId} style={styles.shareRow}>
                <View style={styles.shareTile}>
                  <Text style={styles.shareTileText}>{initialsOf(r.name)}</Text>
                </View>
                <Text style={styles.shareName} numberOfLines={1}>
                  {r.name}
                </Text>
                <LinearGradient
                  {...GRADIENT_PROPS}
                  style={[styles.barFill, { width: Math.max(6, Math.round((r.amount / maxShare) * 78)) }]}
                />
                <Text style={styles.shareAmt}>₹{Math.round(r.amount).toLocaleString('en-IN')}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable onPress={save} disabled={!canSave} style={[styles.saveButtonShape, !canSave && styles.saveButtonDisabled]}>
          <LinearGradient {...GRADIENT_PROPS} style={styles.saveButtonFill}>
            <Text style={styles.saveLabel}>Save split</Text>
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
  headerMeta: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.splitInkFaint45,
  },
  scroll: {
    paddingHorizontal: spacing.xxxl,
    paddingBottom: 140,
    gap: spacing.ms,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  categoryPillShape: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  categoryPillFill: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPillOff: {
    backgroundColor: colors.splitSurface,
    shadowColor: colors.splitInk,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 1,
  },
  categoryPillLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: colors.splitInkFaint55,
  },
  categoryPillLabelOn: {
    color: '#fff',
  },
  lines: {
    gap: spacing.xs,
  },
  lineCard: {
    backgroundColor: colors.splitSurface,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  lineTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.ms,
  },
  lineNameInput: {
    flex: 1,
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: colors.splitInk,
    paddingVertical: 2,
  },
  lineAmountInput: {
    fontFamily: fontFamily.sans700,
    fontSize: 15,
    color: colors.splitInk,
    textAlign: 'right',
    minWidth: 64,
    paddingVertical: 2,
  },
  lineAssignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  lineChipShape: {
    width: 38,
    height: 38,
    borderRadius: 13,
    overflow: 'hidden',
  },
  lineChipFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineChipOff: {
    backgroundColor: '#F2F2F7',
  },
  lineChipLabel: {
    fontFamily: fontFamily.sans700,
    fontSize: 12,
    color: 'rgba(27,42,99,.4)',
  },
  lineChipLabelOn: {
    color: '#fff',
  },
  lineEach: {
    marginLeft: 'auto',
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.splitInkFaint5,
  },
  lineEachEmpty: {
    color: colors.splitDangerFg,
  },
  addLineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.splitInkFaint30,
    borderStyle: 'dashed',
    paddingVertical: 12,
  },
  addLineLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: colors.splitAccent,
  },
  sectionTitle: {
    marginTop: spacing.md,
    fontFamily: fontFamily.sans700,
    fontSize: 17,
    color: colors.splitInk,
  },
  emptyNote: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.splitInkFaint45,
  },
  shareRows: {
    gap: 6,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.splitSurface,
    borderRadius: 20,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  shareTile: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 14,
    backgroundColor: '#E9EAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareTileText: {
    fontFamily: fontFamily.sans700,
    fontSize: 12.5,
    color: colors.splitInk,
  },
  shareName: {
    flex: 1,
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.splitInk,
  },
  barFill: {
    height: 7,
    borderRadius: 999,
    flexShrink: 0,
  },
  shareAmt: {
    minWidth: 74,
    textAlign: 'right',
    fontFamily: fontFamily.sans700,
    fontSize: 15,
    color: colors.splitInk,
  },
  footer: {
    paddingHorizontal: spacing.xxxl,
    paddingTop: spacing.xs,
    backgroundColor: colors.splitBg,
  },
  saveButtonShape: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: colors.splitAccent,
    shadowOpacity: 0.34,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 34,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonFill: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  saveLabel: {
    fontFamily: fontFamily.sans700,
    fontSize: 16.5,
    color: '#fff',
  },
});
