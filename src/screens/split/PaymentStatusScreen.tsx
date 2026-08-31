import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';
import { useSplit } from '../../context/SplitContext';

const BACK_ICON = 'M15 5l-7 7 7 7';
const CHECK_ICON = 'M5 12.5l4.5 4.5L19 7';
const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';
const CLOCK_ICON = 'M12 7v5l3.5 2M12 21a9 9 0 100-18 9 9 0 000 18z';

const GRADIENT_PROPS = {
  colors: colors.splitGradient as [string, string, ...string[]],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

/** Verifying / pending / failed / success — driven entirely by the server-tracked payment_attempts row. */
export function PaymentStatusScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { focusedGroup, focusedPaymentAttempt, nameFor, goPayConfirm, goSettle, cancelUpiPayment, confirmUpiPayment, refreshPaymentAttempt } = useSplit();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (focusedPaymentAttempt) refreshPaymentAttempt(focusedPaymentAttempt.id);
    // Only ever needs to run once, when this screen first focuses an attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!focusedGroup || !focusedPaymentAttempt) return null;

  const attempt = focusedPaymentAttempt;
  const isRecipient = user?.id === attempt.recipientUserId;
  const otherPartyName = nameFor(isRecipient ? attempt.payerUserId : attempt.recipientUserId);
  const inFlight = attempt.status === 'initiated' || attempt.status === 'processing' || attempt.status === 'pending';

  const handleCheckAgain = async () => {
    setBusy(true);
    await refreshPaymentAttempt(attempt.id);
    setBusy(false);
  };

  const handleTryAgain = async () => {
    setBusy(true);
    await cancelUpiPayment(attempt.id);
    setBusy(false);
    goPayConfirm(attempt.recipientUserId, attempt.amount);
  };

  const handleConfirmReceipt = async () => {
    setBusy(true);
    setError(null);
    const { error: confirmError } = await confirmUpiPayment(attempt.id);
    setBusy(false);
    if (confirmError) setError(confirmError);
  };

  const renderBody = () => {
    if (attempt.status === 'verified') {
      return (
        <View style={styles.stateCard}>
          <View style={[styles.iconRing, styles.iconRingPositive]}>
            <Icon path={CHECK_ICON} color={colors.splitPositiveFg} size={30} strokeWidth={3} />
          </View>
          <Text style={styles.stateTitle}>Payment confirmed</Text>
          <Text style={styles.stateSub}>
            {isRecipient ? `You confirmed you received ₹${attempt.amount.toLocaleString('en-IN')} from ${otherPartyName}.` : `${otherPartyName} confirmed they received ₹${attempt.amount.toLocaleString('en-IN')}.`}
          </Text>
        </View>
      );
    }

    if (attempt.status === 'failed' || attempt.status === 'expired') {
      return (
        <View style={styles.stateCard}>
          <View style={[styles.iconRing, styles.iconRingDanger]}>
            <Icon path={CLOSE_ICON} color={colors.splitDangerFg} size={26} strokeWidth={3} />
          </View>
          <Text style={styles.stateTitle}>{attempt.status === 'expired' ? 'Payment expired' : 'Payment didn’t go through'}</Text>
          <Text style={styles.stateSub}>{attempt.failureReason ?? 'You can try again whenever you’re ready.'}</Text>
        </View>
      );
    }

    // initiated / processing / pending
    return (
      <View style={styles.stateCard}>
        <View style={[styles.iconRing, styles.iconRingNeutral]}>
          <Icon path={CLOCK_ICON} color={colors.splitInk} size={26} strokeWidth={2} />
        </View>
        <Text style={styles.stateTitle}>{attempt.status === 'pending' ? 'Waiting for confirmation' : 'Verifying…'}</Text>
        <Text style={styles.stateSub}>
          {isRecipient
            ? `${otherPartyName} says they paid you ₹${attempt.amount.toLocaleString('en-IN')}. Confirm once it lands in your UPI app.`
            : `We're waiting for ${otherPartyName} to confirm they received ₹${attempt.amount.toLocaleString('en-IN')}. This isn't automatic — it settles the moment they do.`}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={goSettle} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color={colors.splitInk} size={19} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Payment status</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {renderBody()}
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Reference</Text>
            <Text style={styles.metaValue}>{attempt.reference}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Amount</Text>
            <Text style={styles.metaValue}>₹{attempt.amount.toLocaleString('en-IN')}</Text>
          </View>
        </View>
        {error ? <Text style={styles.errorNote}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {attempt.status === 'verified' ? (
          <Pressable onPress={goSettle} style={styles.primaryShape}>
            <LinearGradient {...GRADIENT_PROPS} style={styles.primaryFill}>
              <Text style={styles.primaryLabel}>Done</Text>
            </LinearGradient>
          </Pressable>
        ) : attempt.status === 'failed' || attempt.status === 'expired' ? (
          <Pressable onPress={handleTryAgain} disabled={busy} style={[styles.primaryShape, busy && styles.disabled]}>
            <LinearGradient {...GRADIENT_PROPS} style={styles.primaryFill}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>Try again</Text>}
            </LinearGradient>
          </Pressable>
        ) : isRecipient ? (
          <Pressable onPress={handleConfirmReceipt} disabled={busy} style={[styles.primaryShape, busy && styles.disabled]}>
            <LinearGradient {...GRADIENT_PROPS} style={styles.primaryFill}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>Confirm receipt</Text>}
            </LinearGradient>
          </Pressable>
        ) : (
          <View style={styles.footerRow}>
            <Pressable onPress={handleCheckAgain} disabled={busy} style={[styles.secondaryButton, busy && styles.disabled]}>
              {busy ? <ActivityIndicator color={colors.splitInk} /> : <Text style={styles.secondaryLabel}>Check again</Text>}
            </Pressable>
            <Pressable onPress={handleTryAgain} disabled={busy} style={[styles.secondaryButton, busy && styles.disabled]}>
              <Text style={styles.secondaryLabel}>Start over</Text>
            </Pressable>
          </View>
        )}
        {inFlight && !isRecipient ? (
          <Text style={styles.footerNote}>You can leave this screen — we'll let you know once {otherPartyName} confirms.</Text>
        ) : null}
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
  scroll: {
    paddingHorizontal: spacing.xxxl,
    paddingBottom: 40,
    gap: spacing.ms,
  },
  stateCard: {
    backgroundColor: colors.splitSurface,
    borderRadius: 26,
    paddingVertical: 32,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: 10,
    shadowColor: colors.splitInk,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 26,
    elevation: 2,
  },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconRingPositive: {
    backgroundColor: colors.splitPositiveBg,
  },
  iconRingDanger: {
    backgroundColor: colors.splitDangerBg,
  },
  iconRingNeutral: {
    backgroundColor: colors.splitInkFaint08,
  },
  stateTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 19,
    color: colors.splitInk,
    textAlign: 'center',
  },
  stateSub: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.splitInkFaint45,
    textAlign: 'center',
  },
  metaCard: {
    backgroundColor: colors.splitSurface,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.splitInkFaint08,
  },
  metaLabel: {
    fontFamily: fontFamily.mono500,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.splitInkFaint45,
  },
  metaValue: {
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    color: colors.splitInk,
  },
  errorNote: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.splitDangerFg,
  },
  footer: {
    paddingHorizontal: spacing.xxxl,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryShape: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  primaryFill: {
    paddingVertical: 17,
    alignItems: 'center',
  },
  primaryLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: '#fff',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors.splitSurface,
    shadowColor: colors.splitInk,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  secondaryLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 14,
    color: colors.splitInk,
  },
  disabled: {
    opacity: 0.6,
  },
  footerNote: {
    fontFamily: fontFamily.sans400,
    fontSize: 11.5,
    color: colors.splitInkFaint42,
    textAlign: 'center',
  },
});
