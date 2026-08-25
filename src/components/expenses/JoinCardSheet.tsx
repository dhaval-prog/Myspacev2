import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontFamily, noOutline, spacing } from '../../theme';
import { BottomSheet } from './BottomSheet';
import { useExpenses } from '../../context/ExpensesContext';

/** Redeem an owner's 11-digit join code to gain view + add-spend access to their card. */
export function JoinCardSheet() {
  const { joinOpen, closeJoin, joinCard } = useExpenses();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (joinOpen) {
      setCode('');
      setError(null);
      setSubmitting(false);
    }
  }, [joinOpen]);

  const valid = code.length === 11;

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await joinCard(code);
    setSubmitting(false);
    if (result.error) setError(result.error);
  };

  return (
    <BottomSheet visible={joinOpen} onClose={closeJoin}>
      <Text style={styles.title}>Join a budget card</Text>
      <Text style={styles.hint}>Enter the 11-digit code the card owner shared with you.</Text>

      <TextInput
        value={code}
        onChangeText={(v) => {
          setCode(v.replace(/\D/g, '').slice(0, 11));
          setError(null);
        }}
        placeholder="000 0000 0000"
        placeholderTextColor={colors.walletSheetTextFaint}
        keyboardType="number-pad"
        style={[styles.input, noOutline]}
      />
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actionsRow}>
        <Pressable onPress={closeJoin} style={styles.cancelButton}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={submit}
          style={[styles.saveButton, { backgroundColor: valid ? colors.walletAccentBlue : 'rgba(22,104,232,.4)' }]}
        >
          <Text style={styles.saveLabel}>{submitting ? 'Joining…' : 'Join card'}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 21,
    color: colors.walletSheetTextPrimary,
  },
  hint: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.walletSheetTextSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.walletSheetBorder,
    backgroundColor: colors.walletSheetFaint,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: fontFamily.mono500,
    fontSize: 17,
    letterSpacing: 1.7,
    color: colors.walletSheetTextPrimary,
  },
  error: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.walletAccentRed,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,.06)',
  },
  cancelLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: colors.walletSheetTextPrimary,
  },
  saveButton: {
    flex: 1.4,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: '#fff',
  },
});
