import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { BottomSheet } from '../../components/expenses/BottomSheet';
import { initialsOf } from '../../components/split/MemberAvatar';
import { useSplit } from '../../context/SplitContext';
import { relativeDateLabel } from '../../utils/expensesFormat';
import type { PaymentAttempt } from '../../types/payments';
import type { Settlement } from '../../types/split';

const BACK_ICON = 'M15 5l-7 7 7 7';
const CHECK_ICON = 'M5 12.5l4.5 4.5L19 7';

const GRADIENT_PROPS = {
  colors: colors.splitGradient as [string, string, ...string[]],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

/** Settle balances one person at a time — via a real UPI payment or a manual mark — and see the settlement history for this split. */
export function SettleUpScreen() {
  const insets = useSafeAreaInsets();
  const {
    focusedGroup,
    balancesFor,
    settlementsFor,
    paymentAttemptsFor,
    settleUp,
    nameFor,
    upiProfileFor,
    goDashboard,
    goPayConfirm,
    goPayStatus,
    remindUpiSetup,
    confirmUpiPayment,
  } = useSplit();
  const [settling, setSettling] = useState<string | null>(null);
  const [reminding, setReminding] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [detailSettlement, setDetailSettlement] = useState<Settlement | null>(null);

  if (!focusedGroup) return null;

  const balances = balancesFor(focusedGroup.id);
  const history = settlementsFor(focusedGroup.id).slice(0, 20);
  const attempts = paymentAttemptsFor(focusedGroup.id);
  const activeStatuses: PaymentAttempt['status'][] = ['initiated', 'processing', 'pending'];

  const handleSettle = async (userId: string, amount: number) => {
    setSettling(userId);
    await settleUp(userId, amount);
    setSettling(null);
  };

  const handleRemind = async (userId: string) => {
    setReminding(userId);
    await remindUpiSetup(userId);
    setReminding(null);
  };

  const handleConfirmReceipt = async (attemptId: string) => {
    setConfirming(attemptId);
    await confirmUpiPayment(attemptId);
    setConfirming(null);
  };

  const detailAttempt = detailSettlement?.paymentAttemptId ? attempts.find((a) => a.id === detailSettlement.paymentAttemptId) : undefined;

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
              const upiProfile = upiProfileFor(b.userId);
              const canPayViaUpi = !!upiProfile?.upiId && upiProfile.upiVerified;

              // A payment either direction that's still in flight for this pair.
              const activeAttempt = attempts.find(
                (a) =>
                  activeStatuses.includes(a.status) &&
                  ((a.payerUserId === b.userId && a.recipientUserId !== b.userId) || a.recipientUserId === b.userId),
              );

              return (
                <View key={b.userId} style={styles.card}>
                  <View style={styles.cardTopRow}>
                    {youOwe ? (
                      <View style={[styles.cardTile, styles.cardTileOff]}>
                        <Text style={styles.cardTileText}>{initialsOf(b.name)}</Text>
                      </View>
                    ) : (
                      <LinearGradient {...GRADIENT_PROPS} style={styles.cardTile}>
                        <Text style={[styles.cardTileText, styles.cardTileTextOn]}>{initialsOf(b.name)}</Text>
                      </LinearGradient>
                    )}
                    <View style={styles.cardTextCol}>
                      <Text style={styles.cardLine}>{youOwe ? `You pay ${b.name}` : `${b.name} pays you`}</Text>
                      <Text style={styles.cardNote}>
                        {activeAttempt
                          ? activeAttempt.payerUserId === b.userId
                            ? `${b.name} says they've paid — confirm once it lands`
                            : 'Payment in progress — waiting on confirmation'
                          : youOwe
                          ? 'Settle to clear this'
                          : 'Waiting for them to settle'}
                      </Text>
                    </View>
                    <Text style={[styles.cardAmt, youOwe ? styles.cardAmtOut : styles.cardAmtIn]}>
                      ₹{Math.round(amount).toLocaleString('en-IN')}
                    </Text>
                  </View>

                  {activeAttempt && activeAttempt.payerUserId === b.userId ? (
                    <Pressable onPress={() => handleConfirmReceipt(activeAttempt.id)} disabled={confirming === activeAttempt.id} style={styles.settleButtonShape}>
                      <LinearGradient {...GRADIENT_PROPS} style={styles.settleButtonFill}>
                        <Text style={styles.settleButtonLabel}>{confirming === activeAttempt.id ? 'Confirming…' : 'Confirm receipt'}</Text>
                      </LinearGradient>
                    </Pressable>
                  ) : activeAttempt ? (
                    <Pressable onPress={() => goPayStatus(activeAttempt.id)} style={styles.trackButton}>
                      <Text style={styles.trackButtonLabel}>View payment status</Text>
                    </Pressable>
                  ) : youOwe && canPayViaUpi ? (
                    <>
                      <Pressable onPress={() => goPayConfirm(b.userId, amount)} style={styles.settleButtonShape}>
                        <LinearGradient {...GRADIENT_PROPS} style={styles.settleButtonFill}>
                          <Text style={styles.settleButtonLabel}>Pay via UPI</Text>
                        </LinearGradient>
                      </Pressable>
                      <Pressable onPress={() => handleSettle(b.userId, amount)} disabled={settling === b.userId} style={styles.manualLink}>
                        <Text style={styles.manualLinkLabel}>{settling === b.userId ? 'Settling…' : 'Or mark as settled manually'}</Text>
                      </Pressable>
                    </>
                  ) : youOwe ? (
                    <>
                      <Pressable onPress={() => handleSettle(b.userId, amount)} disabled={settling === b.userId} style={styles.settleButtonShape}>
                        <LinearGradient {...GRADIENT_PROPS} style={styles.settleButtonFill}>
                          <Text style={styles.settleButtonLabel}>{settling === b.userId ? 'Settling…' : 'Mark as settled'}</Text>
                        </LinearGradient>
                      </Pressable>
                      <Pressable onPress={() => handleRemind(b.userId)} disabled={reminding === b.userId} style={styles.manualLink}>
                        <Text style={styles.manualLinkLabel}>{reminding === b.userId ? 'Sending…' : `Remind ${b.name} to set up UPI`}</Text>
                      </Pressable>
                    </>
                  ) : null}
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
              <Pressable
                key={h.id}
                onPress={() => (h.source === 'upi' ? setDetailSettlement(h) : undefined)}
                style={styles.historyRow}
                accessibilityRole={h.source === 'upi' ? 'button' : undefined}
              >
                <View style={styles.historyIcon}>
                  <Icon path={CHECK_ICON} color={colors.splitPositiveFg} size={15} strokeWidth={3} />
                </View>
                <View style={styles.historyTextCol}>
                  <Text style={styles.historyLine} numberOfLines={1}>
                    {nameFor(h.fromUserId)} paid {nameFor(h.toUserId)} ₹{Math.round(h.amount).toLocaleString('en-IN')}
                  </Text>
                  {h.source === 'upi' ? <Text style={styles.historyBadge}>via UPI</Text> : null}
                </View>
                <Text style={styles.historyWhen}>{relativeDateLabel(new Date(h.createdAt))}</Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <BottomSheet visible={!!detailSettlement} onClose={() => setDetailSettlement(null)}>
        <Text style={styles.sheetTitle}>Payment details</Text>
        {detailSettlement ? (
          <View style={styles.sheetRows}>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>From</Text>
              <Text style={styles.sheetValue}>{nameFor(detailSettlement.fromUserId)}</Text>
            </View>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>To</Text>
              <Text style={styles.sheetValue}>{nameFor(detailSettlement.toUserId)}</Text>
            </View>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>Amount</Text>
              <Text style={styles.sheetValue}>₹{Math.round(detailSettlement.amount).toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>Method</Text>
              <Text style={styles.sheetValue}>UPI</Text>
            </View>
            {detailAttempt ? (
              <>
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetLabel}>Reference</Text>
                  <Text style={styles.sheetValue}>{detailAttempt.reference}</Text>
                </View>
                <View style={styles.sheetRow}>
                  <Text style={styles.sheetLabel}>Paid to</Text>
                  <Text style={styles.sheetValue}>{detailAttempt.recipientUpiId}</Text>
                </View>
              </>
            ) : null}
            <View style={[styles.sheetRow, styles.sheetRowLast]}>
              <Text style={styles.sheetLabel}>Settled</Text>
              <Text style={styles.sheetValue}>{relativeDateLabel(new Date(detailSettlement.createdAt))}</Text>
            </View>
          </View>
        ) : null}
      </BottomSheet>
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
    borderRadius: 26,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 10,
    shadowColor: colors.splitInk,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 26,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
  cardTile: {
    width: 46,
    height: 46,
    flexShrink: 0,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTileOff: {
    backgroundColor: '#E9EAFB',
  },
  cardTileText: {
    fontFamily: fontFamily.sans700,
    fontSize: 13.5,
    color: colors.splitInk,
  },
  cardTileTextOn: {
    color: '#fff',
  },
  cardTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardLine: {
    fontFamily: fontFamily.sans700,
    fontSize: 15.5,
    color: colors.splitInk,
  },
  cardNote: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.splitInkFaint45,
  },
  cardAmt: {
    fontFamily: fontFamily.sans700,
    fontSize: 16,
    color: colors.splitInk,
  },
  cardAmtIn: {
    color: colors.splitPositiveFg,
  },
  cardAmtOut: {
    color: colors.splitDangerFg,
  },
  settleButtonShape: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  settleButtonFill: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  settleButtonLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 14,
    color: '#fff',
  },
  manualLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  manualLinkLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.splitInkFaint45,
    textDecorationLine: 'underline',
  },
  trackButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.splitInkFaint08,
  },
  trackButtonLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 14,
    color: colors.splitInk,
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
  historyTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  historyLine: {
    fontFamily: fontFamily.sans500,
    fontSize: 14,
    color: colors.splitInk,
  },
  historyBadge: {
    fontFamily: fontFamily.mono500,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.splitAccent,
  },
  historyWhen: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.splitInkFaint42,
  },
  sheetTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 17,
    color: colors.splitInk,
    marginBottom: spacing.xs,
  },
  sheetRows: {
    gap: 2,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.splitInkFaint08,
  },
  sheetRowLast: {
    borderBottomWidth: 0,
  },
  sheetLabel: {
    fontFamily: fontFamily.mono500,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.splitInkFaint45,
  },
  sheetValue: {
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    color: colors.splitInk,
    flexShrink: 1,
    textAlign: 'right',
  },
});
