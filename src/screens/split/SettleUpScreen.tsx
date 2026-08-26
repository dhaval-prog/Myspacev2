import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { initialsOf } from '../../components/split/MemberAvatar';
import { useSplit } from '../../context/SplitContext';
import { relativeDateLabel } from '../../utils/expensesFormat';

const BACK_ICON = 'M15 5l-7 7 7 7';
const CHECK_ICON = 'M5 12.5l4.5 4.5L19 7';

const GRADIENT_PROPS = {
  colors: colors.splitGradient as [string, string, ...string[]],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

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
                      <Text style={styles.cardNote}>{youOwe ? 'Settle to clear this' : 'Waiting for them to settle'}</Text>
                    </View>
                    <Text style={[styles.cardAmt, youOwe ? styles.cardAmtOut : styles.cardAmtIn]}>
                      ₹{Math.round(amount).toLocaleString('en-IN')}
                    </Text>
                  </View>
                  {youOwe && (
                    <Pressable onPress={() => handleSettle(b.userId, amount)} disabled={settling === b.userId} style={styles.settleButtonShape}>
                      <LinearGradient {...GRADIENT_PROPS} style={styles.settleButtonFill}>
                        <Text style={styles.settleButtonLabel}>{settling === b.userId ? 'Settling…' : 'Mark as settled'}</Text>
                      </LinearGradient>
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
    gap: 14,
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
