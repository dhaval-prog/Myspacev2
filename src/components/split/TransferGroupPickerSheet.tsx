import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '../../theme';
import { BottomSheet } from '../expenses/BottomSheet';
import { Icon } from '../Icon';
import { SPLIT_CATEGORY_MAP } from '../../data/splitCategories';
import type { SplitGroup } from '../../types/split';

interface TransferGroupPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Every other card the user can transfer into — the focused one is excluded by the caller. */
  groups: SplitGroup[];
  memberCountFor: (groupId: string) => number;
  expenseCount: number;
  busy: boolean;
  onSelect: (groupId: string) => void;
}

/** Picks which other card the selected expenses get duplicated onto. */
export function TransferGroupPickerSheet({ visible, onClose, groups, memberCountFor, expenseCount, busy, onSelect }: TransferGroupPickerSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.7}>
      <Text style={styles.title}>Transfer to which card?</Text>
      <Text style={styles.subtitle}>
        {expenseCount} {expenseCount === 1 ? 'expense' : 'expenses'} will be duplicated onto the card you pick.
      </Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {groups.length === 0 ? (
          <Text style={styles.empty}>You don't have another card yet — create one first.</Text>
        ) : (
          groups.map((g) => {
            const cat = SPLIT_CATEGORY_MAP[g.category] ?? SPLIT_CATEGORY_MAP.Custom;
            const memberCount = memberCountFor(g.id);
            return (
              <Pressable
                key={g.id}
                onPress={() => onSelect(g.id)}
                disabled={busy}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed, busy && styles.rowDisabled]}
                accessibilityRole="button"
                accessibilityLabel={`Transfer to ${g.name}`}
              >
                <View style={[styles.tile, { backgroundColor: cat.tile }]}>
                  <Icon path={cat.icon} color={colors.splitInk} size={18} strokeWidth={1.8} />
                </View>
                <View style={styles.textCol}>
                  <Text style={styles.name} numberOfLines={1}>
                    {g.name}
                  </Text>
                  <Text style={styles.meta}>
                    {memberCount} {memberCount === 1 ? 'person' : 'people'}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 21,
    color: colors.splitInk,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.splitInkFaint55,
  },
  list: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  empty: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    color: colors.splitInkFaint45,
    paddingVertical: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.splitSurface,
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
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.splitInk,
  },
  meta: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.splitInkFaint45,
  },
});
