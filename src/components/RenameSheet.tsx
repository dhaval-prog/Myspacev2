import React, { useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography, noOutline } from '../theme';
import { useFocusBorder } from '../hooks/useFocusBorder';

interface RenameSheetProps {
  visible: boolean;
  initialValue: string;
  onCancel: () => void;
  onSave: (value: string) => void;
}

/** Bottom sheet for renaming a room. */
export function RenameSheet({ visible, initialValue, onCancel, onSave }: RenameSheetProps) {
  const [value, setValue] = useState(initialValue);
  const { borderColor, onFocus, onBlur } = useFocusBorder(colors.border, colors.ink);

  React.useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Dismiss" />
      <View style={styles.sheet}>
        <Text style={typography.monoLabel}>Rename room</Text>
        <Animated.View style={[styles.inputWrap, { borderColor }]}>
          <TextInput
            value={value}
            onChangeText={setValue}
            onFocus={onFocus}
            onBlur={onBlur}
            style={[typography.sheetInput, styles.input, noOutline]}
            autoFocus
            accessibilityLabel="Room name"
          />
        </Animated.View>
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
  inputWrap: {
    marginTop: spacing.ms,
    backgroundColor: colors.white,
    borderRadius: radius.md - 8,
    borderWidth: 1.5,
  },
  input: {
    padding: spacing.md - 1.5,
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
