import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { BottomSheet } from '../../components/expenses/BottomSheet';
import { initialsOf } from '../../components/split/MemberAvatar';
import { useSplit } from '../../context/SplitContext';
import { getAvailableUpiApps, launchUpiPayment, type UpiApp } from '../../lib/upi';
import type { PaymentAttempt } from '../../types/payments';

const BACK_ICON = 'M15 5l-7 7 7 7';
const CHEVRON_ICON = 'M9 6l6 6-6 6';

const GRADIENT_PROPS = {
  colors: colors.splitGradient as [string, string, ...string[]],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

function noteFor(groupName: string): string {
  return `Split: ${groupName}`.slice(0, 50);
}

/** "Pay ₹X" confirmation — stages a real UPI Intent payment before handing off to the recipient's UPI app. */
export function PaymentConfirmScreen() {
  const insets = useSafeAreaInsets();
  const { focusedGroup, pendingPayment, nameFor, upiProfileFor, createUpiPayment, markUpiPaymentSent, goPayStatus, goSettle } = useSplit();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appChoices, setAppChoices] = useState<UpiApp[]>([]);
  const [appPickerOpen, setAppPickerOpen] = useState(false);
  const [createdAttempt, setCreatedAttempt] = useState<PaymentAttempt | null>(null);

  if (!focusedGroup || !pendingPayment) return null;

  const recipientName = nameFor(pendingPayment.recipientUserId);
  const recipientProfile = upiProfileFor(pendingPayment.recipientUserId);
  const amount = pendingPayment.amount;

  const launchAndProceed = async (attempt: PaymentAttempt, app?: UpiApp) => {
    await launchUpiPayment(
      { payeeVpa: attempt.recipientUpiId, payeeName: recipientName, amount: attempt.amount, reference: attempt.reference, note: noteFor(focusedGroup.name) },
      app,
    );
    await markUpiPaymentSent(attempt.id, app?.id);
    goPayStatus(attempt.id);
  };

  const handleContinue = async () => {
    if (!recipientProfile?.upiId || !recipientProfile.upiVerified) {
      setError(`${recipientName} hasn't verified a UPI ID yet.`);
      return;
    }
    setError(null);
    setSubmitting(true);
    const { attempt, error: createError } = await createUpiPayment(pendingPayment.recipientUserId, amount);
    setSubmitting(false);
    if (createError || !attempt) {
      setError(createError ?? 'Could not start this payment.');
      return;
    }

    if (Platform.OS === 'ios') {
      const apps = await getAvailableUpiApps({
        payeeVpa: attempt.recipientUpiId,
        payeeName: recipientName,
        amount: attempt.amount,
        reference: attempt.reference,
        note: noteFor(focusedGroup.name),
      });
      if (apps.length === 0) {
        setError('No UPI app found on this device — you can still complete this payment another way and confirm below.');
        goPayStatus(attempt.id);
        return;
      }
      if (apps.length === 1) {
        await launchAndProceed(attempt, apps[0]);
        return;
      }
      setCreatedAttempt(attempt);
      setAppChoices(apps);
      setAppPickerOpen(true);
      return;
    }

    // Android: the generic upi:// intent opens the OS's own chooser.
    await launchAndProceed(attempt);
  };

  const choosePickerApp = async (app: UpiApp) => {
    setAppPickerOpen(false);
    if (createdAttempt) await launchAndProceed(createdAttempt, app);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={goSettle} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color={colors.splitInk} size={19} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Pay {recipientName}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.amountCard}>
          <LinearGradient {...GRADIENT_PROPS} style={styles.avatarTile}>
            <Text style={styles.avatarTileText}>{initialsOf(recipientName)}</Text>
          </LinearGradient>
          <Text style={styles.amountLabel}>You're paying</Text>
          <Text style={styles.amountValue}>₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
          <Text style={styles.amountSub}>to {recipientName} · {focusedGroup.name}</Text>
        </View>

        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>UPI ID</Text>
            <Text style={styles.detailValue}>
              {recipientProfile?.upiId ?? 'Not set up'} {recipientProfile?.upiVerified ? '✓' : ''}
            </Text>
          </View>
        </View>

        {!recipientProfile?.upiVerified ? (
          <Text style={styles.warnNote}>
            {recipientName} needs to add and verify a UPI ID in their account settings before you can pay them directly.
          </Text>
        ) : (
          <Text style={styles.infoNote}>
            MySpace opens your UPI app with the amount pre-filled. Once you pay, {recipientName} confirms receipt on their end — that's what
            actually marks this settled, since MySpace can't verify a direct bank transfer on its own.
          </Text>
        )}

        {error ? <Text style={styles.errorNote}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          onPress={handleContinue}
          disabled={submitting || !recipientProfile?.upiVerified}
          style={[styles.continueShape, (submitting || !recipientProfile?.upiVerified) && styles.continueDisabled]}
        >
          <LinearGradient {...GRADIENT_PROPS} style={styles.continueFill}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.continueLabel}>Continue to pay</Text>}
          </LinearGradient>
        </Pressable>
      </View>

      <BottomSheet visible={appPickerOpen} onClose={() => setAppPickerOpen(false)}>
        <Text style={styles.sheetTitle}>Choose a UPI app</Text>
        {appChoices.map((app) => (
          <Pressable key={app.id} onPress={() => choosePickerApp(app)} style={styles.appRow} accessibilityRole="button" accessibilityLabel={app.label}>
            <Text style={styles.appRowLabel}>{app.label}</Text>
            <Icon path={CHEVRON_ICON} color={colors.splitInkFaint45} size={16} strokeWidth={2} />
          </Pressable>
        ))}
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
    flex: 1,
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
  amountCard: {
    backgroundColor: colors.splitSurface,
    borderRadius: 26,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 6,
    shadowColor: colors.splitInk,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 26,
    elevation: 2,
  },
  avatarTile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarTileText: {
    fontFamily: fontFamily.sans700,
    fontSize: 16,
    color: '#fff',
  },
  amountLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 13,
    color: colors.splitInkFaint45,
  },
  amountValue: {
    fontFamily: fontFamily.sans700,
    fontSize: 38,
    letterSpacing: -0.6,
    color: colors.splitInk,
  },
  amountSub: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.splitInkFaint45,
  },
  detailCard: {
    backgroundColor: colors.splitSurface,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  detailLabel: {
    fontFamily: fontFamily.mono500,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.splitInkFaint45,
  },
  detailValue: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: colors.splitInk,
  },
  infoNote: {
    fontFamily: fontFamily.sans400,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.splitInkFaint45,
  },
  warnNote: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.splitDangerFg,
  },
  errorNote: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.splitDangerFg,
  },
  footer: {
    paddingHorizontal: spacing.xxxl,
    paddingTop: spacing.sm,
  },
  continueShape: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  continueDisabled: {
    opacity: 0.5,
  },
  continueFill: {
    paddingVertical: 17,
    alignItems: 'center',
  },
  continueLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: '#fff',
  },
  sheetTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 17,
    color: colors.splitInk,
    marginBottom: spacing.xs,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.splitInkFaint08,
  },
  appRowLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.splitInk,
  },
});
