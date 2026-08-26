import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { MemberAvatar } from '../../components/split/MemberAvatar';
import { useSplit } from '../../context/SplitContext';
import { relativeDateLabel } from '../../utils/expensesFormat';

const BACK_ICON = 'M15 5l-7 7 7 7';
const CHECK_ICON = 'M5 12.5l4.5 4.5L19 7';

/** Settle balances one person at a time, and see the settlement history for this split. */
export function SettleUpScreen() {
  const insets = useSafeAreaInsets();
  const { focusedGroup, balancesFor, settlementsFor, settleUp, nameFor, goDashboard } = useSplit();
  const [settling, setSettling] = useState<string | null>(null);

  if (!focusedGroup) return null;

  const balances = balancesFor(focusedGroup.id);
  const history = settlementsFor(focusedGroup.id).slice(0, 20);

  const handleSettle = async (userId: string, amount: number) => {
    setSettling(userId);
    await settleUp(userId, amount);
    setSettling(null);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={goDashboard} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color={colors.splitInk} size={19} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Settle up</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.rows}>
          {balances.length === 0 ? (
            <Text style={styles.emptyNote}>Everyone's settled up — nothing to pay or collect.</Text>
          ) : (
            balances.map((b) => {
              const youOwe = b.net < 0;
              const amount = Math.abs(b.net);
              return (
                <View key={b.userId} style={styles.card}>
                  <View style={styles.cardTopRow}>
                    <MemberAvatar userId={b.userId} name={b.name} size={40} />
                    <View style={styles.cardTextCol}>
                      <Text style={styles.cardLine}>
                        {youOwe ? `You owe ${b.name}` : `${b.name} owes you`}
                      </Text>
                      <Text style={styles.cardNote}>{youOwe ? 'Settle to clear this' : 'Waiting for them to settle'}</Text>
                    </View>
                    <Text style={styles.cardAmt}>₹{Math.round(amount).toLocaleString('en-IN')}</Text>
                  </View>
                  {youOwe && (
                    <Pressable
                      onPress={() => handleSettle(b.userId, amount)}
                      disabled={settling === b.userId}
                      style={styles.settleButton}
                    >
                      <Text style={styles.settleButtonLabel}>{settling === b.userId ? 'Settling…' : 'Mark as paid'}</Text>
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
        </View>

        <Text style={styles.sectionTitle}>Settlement history</Text>
        <View style={styles.historyRows}>
          {history.length === 0 ? (
            <Text style={styles.emptyNote}>Nothing settled yet — mark a payment above and it lands here, so nobody has to remember.</Text>
          ) : (
            history.map((h) => (
              <View key={h.id} style={styles.historyRow}>
                <View style={styles.historyIcon}>
                  <Icon path={CHECK_ICON} color={colors.splitPositiveFg} size={15} strokeWidth={3} />
                </View>
                <Text style={styles.historyLine} numberOfLines={1}>
                  {nameFor(h.fromUserId)} paid {nameFor(h.toUserId)} ₹{Math.round(h.amount).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.historyWhen}>{relativeDateLabel(new Date(h.createdAt))}</Text>
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
  },
  headerTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 21,
    letterSpacing: -0.2,
    color: colors.splitInk,
  },
  scroll: {
    paddingHorizontal: spacing.xxxl,
    paddingBottom: 40,
    gap: spacing.ms,
  },
  rows: {
    gap: spacing.ms,
  },
  emptyNote: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.splitInkFaint45,
  },
  card: {
    backgroundColor: colors.splitSurface,
    borderRadius: 22,
    padding: spacing.md,
    gap: spacing.ms,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
  cardTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardLine: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.splitInk,
  },
  cardNote: {
    fontFamily: fontFamily.sans400,
    fontSize: 11.5,
    color: colors.splitInkFaint45,
  },
  cardAmt: {
    fontFamily: fontFamily.sans700,
    fontSize: 16,
    color: colors.splitInk,
  },
  settleButton: {
    borderRadius: 999,
    backgroundColor: colors.splitInk,
    paddingVertical: 12,
    alignItems: 'center',
  },
  settleButtonLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: '#fff',
  },
  sectionTitle: {
    marginTop: spacing.md,
    fontFamily: fontFamily.sans700,
    fontSize: 17,
    color: colors.splitInk,
  },
  historyRows: {
    gap: spacing.xs,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: colors.splitSurface,
    borderRadius: 20,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
  },
  historyIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.splitPositiveBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyLine: {
    flex: 1,
    fontFamily: fontFamily.sans500,
    fontSize: 14,
    color: colors.splitInk,
  },
  historyWhen: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.splitInkFaint42,
  },
});
