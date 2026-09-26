import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithSafeArea } from '../../../testUtils/renderWithSafeArea';
import { FullScreenAlertOverlay } from '../FullScreenAlertOverlay';
import type { ThrowAlert } from '../../../types/throw';

const alert: ThrowAlert = {
  id: 'a1',
  messageText: "Don't forget to stretch!",
  strokes: null,
  penColor: '#4A90D9',
  recurrence: 'everyday',
  daysOfWeek: [],
  dayOfMonth: null,
  hour: 9,
  minute: 0,
  nextTriggerAt: new Date().toISOString(),
  active: true,
};

describe('FullScreenAlertOverlay', () => {
  it('shows the alert\'s own written text and a snooze button', async () => {
    await renderWithSafeArea(<FullScreenAlertOverlay alert={alert} onSnooze={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText("Don't forget to stretch!")).toBeTruthy();
    expect(screen.getByLabelText('Snooze 5 minutes')).toBeTruthy();
  });

  it('calls onSnooze when the snooze button is pressed', async () => {
    const onSnooze = jest.fn();
    await renderWithSafeArea(<FullScreenAlertOverlay alert={alert} onSnooze={onSnooze} onDismiss={() => {}} />);
    await fireEvent.press(screen.getByLabelText('Snooze 5 minutes'));
    expect(onSnooze).toHaveBeenCalledTimes(1);
  });
});
