import React, { useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, EASE, fontFamily, spacing } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { Icon } from '../../components/Icon';
import { WalletCarousel } from '../../components/expenses/WalletCarousel';
import { ExpenseRow } from '../../components/expenses/ExpenseRow';
import { useExpenses } from '../../context/ExpensesContext';

const ARROW_UP = 'M12 19V5M6 11l6-6 6 6';
const ARROW_DOWN = 'M12 5v14M6 13l6 6 6-6';
const PLUS_ICON = 'M12 5v14M5 12h14';
const HISTORY_ICON = 'M4 6h16M4 12h16M4 18h16';
const INVITE_ICON = 'M12 3v12M7 8l5-5 5 5M5 21h14';
const LEAVE_ICON = 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9';
const MEMBERS_ICON = 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75';

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
  const reduceMotion = useReducedMotion();
  const { focusedCard, backToPick, openSpend, openAddMoney, askDelete, askLeave, openHistory, openInvite, openMembers, expensesFor } = useExpenses();

  const expenses = expensesFor(focusedCard);

  // The pick screen's card lift ends with a hard component swap into this
  // screen; fading it in (rather than popping in fully opaque) keeps that
  // swap from reading as an abrupt cut.
  const entrance = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: reduceMotion ? 0 : 220,
      easing: EASE,
      useNativeDriver: true,
    }).start();
    // Runs once per mount — this screen remounts fresh each time a card opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.screen}>
      <Animated.View
        style={[
          styles.content,
          { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
        ]}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.huge }]}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {focusedCard?.label ?? ''}
          </Text>
        </View>

        <View style={styles.carouselWrap}>
          <WalletCarousel />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            <ActionPill icon={MEMBERS_ICON} label="Members" onPress={openMembers} small />
            <ActionPill icon={ARROW_UP} label="Add Spend" onPress={openSpend} />
            <ActionPill icon={PLUS_ICON} label="Add Money" onPress={openAddMoney} />
            {focusedCard?.isOwner && <ActionPill icon={ARROW_DOWN} label="Delete" onPress={askDelete} />}
            <ActionPill icon={HISTORY_ICON} label="History" onPress={openHistory} small />
            {focusedCard && !focusedCard.isOwner && <ActionPill icon={LEAVE_ICON} label="Leave" onPress={askLeave} small />}
            <ActionPill icon={INVITE_ICON} label="Invite" onPress={openInvite} small />
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
      </Animated.View>

      <Pressable
        onPress={backToPick}
        style={[styles.backButtonFloating, { bottom: Math.max(insets.bottom, spacing.md) + spacing.md }]}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Text style={styles.backArrow}>←</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.walletBg,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  backButtonFloating: {
    position: 'absolute',
    left: spacing.xxxl,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.walletSurface,
    borderWidth: 1,
    borderColor: colors.walletBorder,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
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
