import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { initialsOf } from '../../components/split/MemberAvatar';
import { useSplit } from '../../context/SplitContext';
import { SPLIT_EXPENSE_CATEGORIES, SPLIT_EXPENSE_ICON_DEFAULT, SPLIT_EXPENSE_ICON_MAP } from '../../data/splitExpenseCategories';

const BACK_ICON = 'M15 5l-7 7 7 7';
const CATEGORY_ORDER = SPLIT_EXPENSE_CATEGORIES.map((c) => c.label);

const GRADIENT_PROPS = {
  colors: colors.splitGradient as [string, string, ...string[]],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

/** "By items" — a read-only breakdown of this split's real expenses, grouped by category, plus everyone's total share. */
export function ItemSplitScreen() {
  const insets = useSafeAreaInsets();
  const { focusedGroup, membersFor, expensesFor, goDashboard } = useSplit();
  const members = focusedGroup ? membersFor(focusedGroup.id) : [];
  const expenses = focusedGroup ? expensesFor(focusedGroup.id) : [];

  const categoryGroups = useMemo(() => {
    const map = new Map<string, { total: number; participantIds: Set<string> }>();
    for (const e of expenses) {
      const key = e.category || 'Other';
      const entry = map.get(key) ?? { total: 0, participantIds: new Set<string>() };
      entry.total += e.amount;
      for (const s of e.shares) entry.participantIds.add(s.userId);
      map.set(key, entry);
    }
    const known = CATEGORY_ORDER.filter((label) => map.has(label)).map((label) => ({ category: label, ...map.get(label)! }));
    const rest = Array.from(map.entries())
      .filter(([category]) => !CATEGORY_ORDER.includes(category))
      .map(([category, v]) => ({ category, ...v }));
    return [...known, ...rest];
  }, [expenses]);

  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

  const shareRows = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of expenses) for (const s of e.shares) totals.set(s.userId, (totals.get(s.userId) ?? 0) + s.amount);
    return members
      .map((m) => ({ ...m, amount: totals.get(m.userId) ?? 0 }))
      .filter((r) => r.amount > 0.01)
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, members]);

  const maxShare = Math.max(1, ...shareRows.map((r) => r.amount));

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
            ₹{Math.round(grandTotal).toLocaleString('en-IN')} · by category
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>By category</Text>
        <View style={styles.lines}>
          {categoryGroups.length === 0 ? (
            <Text style={styles.emptyNote}>No expenses yet to break down by category.</Text>
          ) : (
            categoryGroups.map((g) => {
              const iconPath = SPLIT_EXPENSE_ICON_MAP[g.category] ?? SPLIT_EXPENSE_ICON_DEFAULT;
              const participants = members.filter((m) => g.participantIds.has(m.userId));
              const each = participants.length > 0 ? g.total / participants.length : 0;
              return (
                <View key={g.category} style={styles.lineCard}>
                  <View style={styles.lineTopRow}>
                    <View style={styles.lineIcon}>
                      <Icon path={iconPath} color={colors.splitAccent} size={18} strokeWidth={1.8} />
                    </View>
                    <Text style={styles.lineName}>{g.category}</Text>
                    <Text style={styles.lineAmt}>₹{Math.round(g.total).toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.lineAssignRow}>
                    {participants.map((m) => (
                      <LinearGradient key={m.userId} {...GRADIENT_PROPS} style={styles.lineChip}>
                        <Text style={styles.lineChipLabel}>{initialsOf(m.name)}</Text>
                      </LinearGradient>
                    ))}
                    <Text style={styles.lineEach}>{participants.length > 0 ? `₹${Math.round(each).toLocaleString('en-IN')} each` : 'unassigned'}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <Text style={styles.sectionTitle}>Everyone owes</Text>
        <View style={styles.shareRows}>
          {shareRows.length === 0 ? (
            <Text style={styles.emptyNote}>Add an expense to see who owes what.</Text>
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
    paddingBottom: 40,
    gap: spacing.ms,
  },
  sectionTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 17,
    color: colors.splitInk,
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
    alignItems: 'center',
    gap: spacing.ms,
  },
  lineIcon: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 14,
    backgroundColor: colors.splitAccentSoftBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineName: {
    flex: 1,
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: colors.splitInk,
  },
  lineAmt: {
    fontFamily: fontFamily.sans700,
    fontSize: 15,
    color: colors.splitInk,
  },
  lineAssignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  lineChip: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineChipLabel: {
    fontFamily: fontFamily.sans700,
    fontSize: 12,
    color: '#fff',
  },
  lineEach: {
    marginLeft: 'auto',
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.splitInkFaint5,
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
});
