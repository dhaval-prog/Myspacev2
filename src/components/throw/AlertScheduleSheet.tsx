import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { BottomSheet } from '../expenses/BottomSheet';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
import { AlertScheduleHeader } from './AlertScheduleHeader';
import type { AlertSchedule } from '../../types/throw';

interface AlertScheduleSheetProps {
  visible: boolean;
  onClose: () => void;
  schedule: AlertSchedule;
  onChange: (schedule: AlertSchedule) => void;
}

/**
 * The self-reminder alert's time/day picker, in its own bottom sheet rather than living directly
 * on the letter's paper — embedded inline, the wheel picker's own scroll gesture and the paper's
 * scroll-to-fold gesture (both listening for a vertical drag/wheel over the same card) fought over
 * the same touches, so scrolling the wheel could fold the letter into a paper plane out from under
 * it. A sheet removes that conflict entirely: it's a real Modal, outside the paper's own
 * gesture-capturing view, so nothing it receives ever reaches FoldingLetter's fold handlers.
 */
export function AlertScheduleSheet({ visible, onClose, schedule, onChange }: AlertScheduleSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AlertScheduleHeader schedule={schedule} onChange={onChange} />
      <Pressable onPress={onClose} style={styles.doneButton} accessibilityRole="button" accessibilityLabel="Done">
        <Text style={styles.doneLabel}>Done</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  doneButton: {
    borderRadius: throwRadius.pill,
    backgroundColor: throwColor.clayDeep,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  doneLabel: { fontFamily: throwFont.ui700, fontSize: 15, color: '#fff' },
});
