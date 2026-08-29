import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '../../theme';
import { useExpenses } from '../../context/ExpensesContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/** Centered confirmation popup for removing a card, or a member leaving one. */
export function ConfirmDeleteModal() {
  const { confirmDeleteOpen, cancelDelete, deleteFocusedCard, confirmLeaveOpen, cancelLeave, leaveFocusedCard } = useExpenses();
  const reduceMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(0.72)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const open = confirmDeleteOpen || confirmLeaveOpen;
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      scale.setValue(reduceMotion ? 1 : 0.72);
      opacity.setValue(reduceMotion ? 1 : 0);
      Animated.timing(scale, {
        toValue: 1,
        duration: reduceMotion ? 0 : 300,
        easing: (t) => 1 - Math.pow(1 - t, 3),
        useNativeDriver: true,
      }).start();
      Animated.timing(opacity, { toValue: 1, duration: reduceMotion ? 0 : 220, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(opacity, { toValue: 0, duration: reduceMotion ? 0 : 160, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // mounted intentionally excluded — driven by open, not itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reduceMotion, scale, opacity]);

  if (!mounted) return null;

  const cancel = confirmLeaveOpen ? cancelLeave : cancelDelete;
  const confirm = confirmLeaveOpen ? leaveFocusedCard : deleteFocusedCard;
  const message = confirmLeaveOpen ? 'Leave this budget card?' : 'Would you like to remove the card?';

  return (
    <Modal visible transparent animationType="none" onRequestClose={cancel} statusBarTranslucent>
      <View style={styles.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={cancel} accessibilityRole="button" accessibilityLabel="Dismiss" />
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.row}>
            <Pressable onPress={cancel} style={styles.noButton}>
              <Text style={styles.noLabel}>No</Text>
            </Pressable>
            <Pressable onPress={confirm} style={styles.yesButton}>
              <Text style={styles.yesLabel}>Yes</Text>
            </Pressable>
          </View>
        </Animated.View>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  card: {
    width: '100%',
    backgroundColor: colors.walletSheetBg,
    borderRadius: 26,
    paddingTop: spacing.huge,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  message: {
    textAlign: 'center',
    fontFamily: fontFamily.sans600,
    fontSize: 17,
    lineHeight: 23.8,
    color: colors.walletSheetTextPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  noButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,.06)',
  },
  noLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.walletSheetTextPrimary,
  },
  yesButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: colors.walletAccentRed,
  },
  yesLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: '#fff',
  },
});
