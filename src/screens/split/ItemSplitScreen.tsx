import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, noOutline, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { MemberAvatar } from '../../components/split/MemberAvatar';
import { useSplit } from '../../context/SplitContext';

const BACK_ICON = 'M15 5l-7 7 7 7';
const PLUS_ICON = 'M12 6v12M6 12h12';

interface Line {
  id: string;
  name: string;
  amount: string;
  assigned: Set<string>;
}

/** Line-by-line "Smart Split" — assign each item on the bill to whoever shares it. */
export function ItemSplitScreen() {
  const insets = useSafeAreaInsets();
  const { focusedGroup, membersFor, addItemizedExpense, goDashboard } = useSplit();
  const members = focusedGroup ? membersFor(focusedGroup.id) : [];
  const allIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);

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
  const canSave = total > 0 && lines.some((l) => (Number(l.amount) || 0) > 0 && l.assigned.size > 0);

  const save = () => {
    if (!canSave || !focusedGroup) return;
    addItemizedExpense({
      paidBy: members[0]?.userId ?? '',
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
          <Text style={styles.headerMeta}>₹{Math.round(total).toLocaleString('en-IN')} · assign each line</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
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
                {members.map((m) => (
                  <MemberAvatar
                    key={m.userId}
                    userId={m.userId}
                    name={m.name}
                    size={30}
                    selected={line.assigned.has(m.userId)}
                    onPress={() => toggleAssign(line.id, m.userId)}
                  />
                ))}
                {line.assigned.size > 0 && Number(line.amount) > 0 && (
                  <Text style={styles.lineEach}>₹{Math.round(Number(line.amount) / line.assigned.size).toLocaleString('en-IN')} each</Text>
                )}
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
                <MemberAvatar userId={r.userId} name={r.name} size={36} />
                <Text style={styles.shareName} numberOfLines={1}>
                  {r.name}
                </Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.max(6, (r.amount / maxShare) * 100)}%` }]} />
                </View>
                <Text style={styles.shareAmt}>₹{Math.round(r.amount).toLocaleString('en-IN')}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable onPress={save} disabled={!canSave} style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}>
          <Text style={styles.saveLabel}>Save split</Text>
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
  lines: {
    gap: spacing.xs,
  },
  lineCard: {
    backgroundColor: colors.splitSurface,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.md,
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
  lineEach: {
    fontFamily: fontFamily.sans500,
    fontSize: 12,
    color: colors.splitInkFaint45,
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
    gap: spacing.ms,
    backgroundColor: colors.splitSurface,
    borderRadius: 20,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
  },
  shareName: {
    width: 74,
    fontFamily: fontFamily.sans600,
    fontSize: 14,
    color: colors.splitInk,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.splitInkFaint08,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.splitAccent,
  },
  shareAmt: {
    minWidth: 70,
    textAlign: 'right',
    fontFamily: fontFamily.sans700,
    fontSize: 14,
    color: colors.splitInk,
  },
  footer: {
    paddingHorizontal: spacing.xxxl,
    paddingTop: spacing.xs,
    backgroundColor: colors.splitBg,
  },
  saveButton: {
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
