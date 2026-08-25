import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { WalletCarousel } from '../../components/expenses/WalletCarousel';
import { ExpenseRow } from '../../components/expenses/ExpenseRow';
import { useExpenses } from '../../context/ExpensesContext';

const ARROW_UP = 'M12 19V5M6 11l6-6 6 6';
const ARROW_DOWN = 'M12 5v14M6 13l6 6 6-6';
const HISTORY_ICON = 'M4 6h16M4 12h16M4 18h16';
const INVITE_ICON = 'M12 3v12M7 8l5-5 5 5M5 21h14';

function ActionPill({ icon, label, onPress, small }: { icon: string; label: string; onPress: () => void; small?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.pill} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.pillIcon, small && styles.pillIconSmall]}>
        <Icon path={icon} color="#fff" size={small ? 13 : 14} strokeWidth={1.8} />
      </View>
      <Text style={styles.pillLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

interface WalletScreenProps {
  onHome: () => void;
}

export function WalletScreen({ onHome }: WalletScreenProps) {
  const insets = useSafeAreaInsets();
  const { focusedCard, backToPick, openSpend, askDelete, openHistory, openInvite, expensesFor } = useExpenses();

  const expenses = expensesFor(focusedCard);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.huge }]}>
        <Pressable onPress={backToPick} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {focusedCard?.label ?? ''}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.carouselWrap}>
        <WalletCarousel />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
          <ActionPill icon={ARROW_UP} label="Add Spend" onPress={openSpend} />
          {focusedCard?.isOwner && <ActionPill icon={ARROW_DOWN} label="Delete" onPress={askDelete} />}
          <ActionPill icon={HISTORY_ICON} label="History" onPress={openHistory} small />
          {focusedCard?.isOwner && <ActionPill icon={INVITE_ICON} label="Invite" onPress={openInvite} small />}
        </ScrollView>
      </View>

      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>Expenses</Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetList}>
          {expenses.length === 0 ? (
            <Text style={styles.emptyText}>No spends on this card yet.{'\n'}Add one and it shows up here.</Text>
          ) : (
            expenses.map((expense, i) => <ExpenseRow key={`${expense.title}-${i}`} expense={expense} />)
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.walletBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxxl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.walletSurface,
    borderWidth: 1,
    borderColor: colors.walletBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 17,
    color: colors.walletTextPrimary,
  },
  headerTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.walletTextPrimary,
  },
  carouselWrap: {
    paddingTop: spacing.xl,
  },
  pillRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.xl,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.walletSurface,
    borderWidth: 1,
    borderColor: colors.walletBorder,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  pillIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillIconSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  pillLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 14,
    color: '#fff',
  },
  sheet: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.walletSheetBg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: spacing.xxxl,
    paddingTop: spacing.xxl,
  },
  sheetTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 19,
    letterSpacing: -0.19,
    color: colors.walletSheetTextPrimary,
    marginBottom: spacing.md,
  },
  sheetList: {
    gap: spacing.md,
    paddingBottom: spacing.huge,
  },
  emptyText: {
    marginTop: spacing.xxl,
    textAlign: 'center',
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.walletSheetTextFaint,
  },
});
