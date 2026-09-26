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
  /** Inverts the whole sheet to a black background with white/light chrome — a literal black↔white
   * swap of the normal light sheet, per explicit request, driven by the same signal as
   * FoldingLetter's own night skin (not a whole-app dark mode: every other sheet in the app is
   * unaffected). */
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
    <BottomSheet
      visible={visible}
      onClose={onClose}
      backgroundColor={isNight ? '#000000' : undefined}
      handleColor={isNight ? 'rgba(255,255,255,.3)' : undefined}
    >
      <AlertScheduleHeader schedule={schedule} onChange={onChange} isNight={isNight} />
      <Pressable
        onPress={onClose}
        style={[styles.doneButton, isNight && styles.doneButtonNight]}
        accessibilityRole="button"
        accessibilityLabel="Done"
      >
        <Text style={[styles.doneLabel, isNight && styles.doneLabelNight]}>Done</Text>
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
  // A literal black↔white invert of the day button: white fill instead of clay-brown, black
  // label instead of white — the sheet itself is now black (see BottomSheet's backgroundColor
  // above), so a black button would disappear into it.
  doneButtonNight: { backgroundColor: '#FFFFFF' },
  doneLabel: { fontFamily: throwFont.ui700, fontSize: 15, color: '#fff' },
  doneLabelNight: { color: '#000000' },
});
