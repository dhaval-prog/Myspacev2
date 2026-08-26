import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontFamily, noOutline, spacing } from '../../theme';
import { BottomSheet } from '../expenses/BottomSheet';
import { useSplit } from '../../context/SplitContext';

interface JoinSplitSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** Redeem an owner's 11-digit join code to gain access to their split. */
export function JoinSplitSheet({ visible, onClose }: JoinSplitSheetProps) {
  const { joinGroup } = useSplit();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const valid = code.length === 11;

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await joinGroup(code);
    setSubmitting(false);
    if (result.error) setError(result.error);
    else {
      setCode('');
      onClose();
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        setCode('');
        setError(null);
        onClose();
      }}
    >
      <Text style={styles.title}>Join a split</Text>
      <Text style={styles.hint}>Enter the 11-digit code the split's owner shared with you.</Text>

      <TextInput
        value={code}
        onChangeText={(v) => {
          setCode(v.replace(/\D/g, '').slice(0, 11));
          setError(null);
        }}
        placeholder="000 0000 0000"
        placeholderTextColor={colors.splitInkFaint45}
        keyboardType="number-pad"
        style={[styles.input, noOutline]}
      />
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actionsRow}>
        <Pressable onPress={onClose} style={styles.cancelButton}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
        <Pressable onPress={submit} style={[styles.saveButton, { backgroundColor: valid ? colors.splitAccent : 'rgba(250,46,110,.4)' }]}>
          <Text style={styles.saveLabel}>{submitting ? 'Joining…' : 'Join split'}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 21,
    color: colors.splitInk,
  },
  hint: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.splitInkFaint55,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.splitInkFaint09,
    backgroundColor: '#F3F3F8',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: fontFamily.mono500,
    fontSize: 17,
    letterSpacing: 1.7,
    color: colors.splitInk,
  },
  error: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.splitDangerFg,
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
    backgroundColor: 'rgba(27,42,99,.06)',
  },
  cancelLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: colors.splitInk,
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
