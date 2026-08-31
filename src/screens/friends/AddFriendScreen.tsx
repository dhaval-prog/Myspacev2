import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { colors, fontFamily, noOutline, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { useFriends } from '../../context/FriendsContext';

const BACK_ICON = 'M15 5l-7 7 7 7';
const SCAN_ICON =
  'M4 8V5.6A1.6 1.6 0 0 1 5.6 4H8M16 4h2.4A1.6 1.6 0 0 1 20 5.6V8M20 16v2.4a1.6 1.6 0 0 1-1.6 1.6H16M8 20H5.6A1.6 1.6 0 0 1 4 18.4V16M7 12h10';

const QR_BOX = 190;

/** Add a friend: share your own code/QR, or enter theirs. */
export function AddFriendScreen() {
  const insets = useSafeAreaInsets();
  const { friendCode, goHome, goScan, lookupCode } = useFriends();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const valid = code.trim().length === 6;

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await lookupCode(code);
    setSubmitting(false);
    if (result.error) setError(result.error);
  };

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.topRow}>
          <Pressable onPress={goHome} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
            <Icon path={BACK_ICON} color={colors.friendsInk} size={19} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>Add a friend</Text>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.qrCard}>
          <Text style={styles.qrLabel}>Your code</Text>
          <View style={styles.qrBox}>
            {friendCode ? (
              <QRCode value={friendCode} size={QR_BOX - spacing.ms * 2} color={colors.friendsInk} backgroundColor="transparent" />
            ) : null}
          </View>
          <Text style={styles.qrCode}>{friendCode ?? '——————'}</Text>
          <Text style={styles.qrHint}>Share this code, or let a friend scan your QR.</Text>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.form}>
          <Text style={styles.formLabel}>Enter their code</Text>
          <TextInput
            value={code}
            onChangeText={(v) => {
              setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
              setError(null);
            }}
            placeholder="M4K7QP"
            placeholderTextColor={colors.friendsInkFaint30}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[styles.input, noOutline]}
          />
          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={submit}
            disabled={!valid || submitting}
            style={[styles.submitButton, { opacity: valid && !submitting ? 1 : 0.4 }]}
          >
            <Text style={styles.submitLabel}>{submitting ? 'Looking…' : 'Find friend'}</Text>
          </Pressable>

          <Pressable onPress={goScan} style={styles.scanOption} accessibilityRole="button" accessibilityLabel="Scan a QR code">
            <Icon path={SCAN_ICON} color={colors.friendsInk} size={17} />
            <Text style={styles.scanOptionLabel}>Scan QR instead</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.friendsBg,
  },
  scroll: {
    paddingHorizontal: spacing.xxxl,
    paddingBottom: spacing.huge,
    gap: spacing.xxl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.friendsSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 19,
    color: colors.friendsInk,
  },
  qrCard: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.friendsSurface,
    borderRadius: 28,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    shadowColor: colors.friendsInk,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 26,
    elevation: 2,
  },
  qrLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 13,
    color: colors.friendsInkFaint55,
  },
  qrBox: {
    width: QR_BOX,
    height: QR_BOX,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.ms,
    backgroundColor: colors.friendsAccentSoftBg,
    borderRadius: 20,
  },
  qrCode: {
    fontFamily: fontFamily.mono500,
    fontSize: 20,
    letterSpacing: 3,
    color: colors.friendsInk,
  },
  qrHint: {
    fontFamily: fontFamily.sans400,
    fontSize: 12.5,
    color: colors.friendsInkFaint45,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.friendsInkFaint08,
  },
  dividerLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 12,
    color: colors.friendsInkFaint45,
  },
  form: {
    gap: spacing.sm,
  },
  formLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: colors.friendsInk,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.friendsInkFaint08,
    backgroundColor: colors.friendsSurface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: fontFamily.mono500,
    fontSize: 18,
    letterSpacing: 3,
    color: colors.friendsInk,
  },
  error: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.splitDangerFg,
  },
  submitButton: {
    borderRadius: 999,
    backgroundColor: colors.friendsAccent,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: '#fff',
  },
  scanOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: 16,
    paddingVertical: 13,
    backgroundColor: colors.friendsAccentSoftBg,
  },
  scanOptionLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: colors.friendsInk,
  },
});
