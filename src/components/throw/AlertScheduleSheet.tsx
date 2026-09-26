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
  /** Swaps the picker's clay/brown accents (Done button, wheel highlight, selected chips) for a
   * black-and-white glow treatment, matching FoldingLetter's own night skin — same signal, not a
   * whole-app dark mode. The sheet itself stays on its normal light chrome; only the accents
   * that were brown switch. */
  isNight?: boolean;
}

/**
 * The self-reminder alert's time/day picker, in its own bottom sheet rather than living directly
 * on the letter's paper — embedded inline, the wheel picker's own scroll gesture and the paper's
 * scroll-to-fold gesture (both listening for a vertical drag/wheel over the same card) fought over
 * the same touches, so scrolling the wheel could fold the letter into a paper plane out from under
 * it. A sheet removes that conflict entirely: it's a real Modal, outside the paper's own
 * gesture-capturing view, so nothing it receives ever reaches FoldingLetter's fold handlers.
 */
export function AlertScheduleSheet({ visible, onClose, schedule, onChange, isNight }: AlertScheduleSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AlertScheduleHeader schedule={schedule} onChange={onChange} isNight={isNight} />
      <Pressable
        onPress={onClose}
        style={[styles.doneButton, isNight && styles.doneButtonNight]}
        accessibilityRole="button"
        accessibilityLabel="Done"
      >
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
  // Night skin — a black fill with a soft white glow instead of the day skin's clay-brown fill,
  // matching the same black-and-white glow treatment as FoldingLetter's active mic button.
  doneButtonNight: {
    backgroundColor: '#000000',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  doneLabel: { fontFamily: throwFont.ui700, fontSize: 15, color: '#fff' },
});
