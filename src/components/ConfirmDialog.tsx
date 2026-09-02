import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Renders only the confirm button, for a plain info popup rather than a confirm/cancel choice. */
  hideCancel?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** An optional third, full-width primary action rendered above the confirm/cancel row — for a dialog with one clearly preferred choice plus a couple of secondary ones. */
  primaryLabel?: string;
  onPrimary?: () => void;
}

/**
 * Centered confirm/cancel popup for actions that need a pause before
 * committing. react-native-web's `Alert.alert` is a no-op on web (it never
 * renders anything or invokes a button's callback), so this is used
 * wherever a confirmation must actually work in the deployed web app.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  hideCancel,
  destructive,
  onConfirm,
  onCancel,
  primaryLabel,
  onPrimary,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Dismiss" />
        <View style={styles.card}>
          <Text style={[typography.detailTitle, styles.title]}>{title}</Text>
          <Text style={[typography.body, styles.message]}>{message}</Text>
          {primaryLabel && onPrimary && (
            <Pressable onPress={onPrimary} style={[styles.button, styles.primaryButton, { backgroundColor: colors.ink }]}>
              <Text style={[typography.buttonLabel, { fontSize: 14, color: colors.lime }]}>{primaryLabel}</Text>
            </Pressable>
          )}
          <View style={styles.actions}>
            {!hideCancel && (
              <Pressable onPress={onCancel} style={[styles.button, { backgroundColor: colors.pressWash }]}>
                <Text style={[typography.buttonLabel, { fontSize: 14, color: colors.textPrimary }]}>{cancelLabel}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={onConfirm}
              style={[styles.button, { backgroundColor: destructive ? colors.danger : primaryLabel ? colors.pressWash : colors.ink }]}
            >
              <Text
                style={[
                  typography.buttonLabel,
                  { fontSize: 14, color: destructive ? colors.white : primaryLabel ? colors.textPrimary : colors.lime },
                ]}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.organic,
    backgroundColor: 'rgba(22,33,12,0.35)',
  },
  card: {
    width: '100%',
    backgroundColor: colors.pale,
    borderRadius: radius.lg,
    padding: spacing.xxxl,
    gap: spacing.sm,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.md - 8,
    alignItems: 'center',
  },
  primaryButton: {
    marginTop: spacing.md,
  },
});
