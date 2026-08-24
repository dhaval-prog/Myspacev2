import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

interface RenameSheetProps {
  visible: boolean;
  initialValue: string;
  onCancel: () => void;
  onSave: (value: string) => void;
}

/** Bottom sheet for renaming a room. */
export function RenameSheet({ visible, initialValue, onCancel, onSave }: RenameSheetProps) {
  const [value, setValue] = useState(initialValue);

  React.useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Dismiss" />
      <View style={styles.sheet}>
        <Text style={typography.monoLabel}>Rename room</Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          style={[typography.sheetInput, styles.input]}
          autoFocus
          accessibilityLabel="Room name"
        />
        <View style={styles.actions}>
          <Pressable onPress={onCancel} style={[styles.button, { backgroundColor: colors.pressWash }]}>
            <Text style={[typography.buttonLabel, { fontSize: 14, color: colors.textPrimary }]}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => onSave(value)} style={[styles.button, { backgroundColor: colors.ink }]}>
            <Text style={[typography.buttonLabel, { fontSize: 14, color: colors.lime }]}>Save</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(22,33,12,0.35)',
  },
  sheet: {
    backgroundColor: colors.pale,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xxxl,
    paddingBottom: spacing.huge + spacing.ms,
  },
  input: {
    marginTop: spacing.ms,
    backgroundColor: colors.white,
    borderRadius: radius.md - 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.md - 8,
    alignItems: 'center',
  },
});
