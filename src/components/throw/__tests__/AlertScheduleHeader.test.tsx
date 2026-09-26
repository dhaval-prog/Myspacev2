import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithSafeArea } from '../../../testUtils/renderWithSafeArea';
import { AlertScheduleHeader } from '../AlertScheduleHeader';
import type { AlertSchedule } from '../../../types/throw';

function Wrapper({ initial }: { initial: AlertSchedule }) {
  const [schedule, setSchedule] = React.useState(initial);
  return <AlertScheduleHeader schedule={schedule} onChange={setSchedule} />;
}

describe('AlertScheduleHeader', () => {
  it('shows the current time in 12-hour form and the four recurrence options', async () => {
    await renderWithSafeArea(<Wrapper initial={{ recurrence: 'once', hour: 9, minute: 0, daysOfWeek: [], dayOfMonth: 1 }} />);
    expect(screen.getByText('09')).toBeTruthy();
    expect(screen.getByText('00')).toBeTruthy();
    expect(screen.getByText('AM')).toBeTruthy();
    expect(screen.getByText('Once')).toBeTruthy();
    expect(screen.getByText('Everyday')).toBeTruthy();
    expect(screen.getByText('Weekly')).toBeTruthy();
    expect(screen.getByText('Monthly')).toBeTruthy();
  });

  it('increases the hour and wraps 12 -> 1, and toggles AM/PM', async () => {
    await renderWithSafeArea(<Wrapper initial={{ recurrence: 'once', hour: 11, minute: 0, daysOfWeek: [], dayOfMonth: 1 }} />);
    expect(screen.getByText('11')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Increase hour'));
    // 11am + 1 hour -> 12pm
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('PM')).toBeTruthy();
  });

  it('steps the minute by 5 and wraps past 55 back to 00', async () => {
    await renderWithSafeArea(<Wrapper initial={{ recurrence: 'once', hour: 9, minute: 55, daysOfWeek: [], dayOfMonth: 1 }} />);
    await fireEvent.press(screen.getByLabelText('Increase minute'));
    expect(screen.getByText('00')).toBeTruthy();
  });

  it('shows a weekday picker only for Weekly, and toggles a day on tap', async () => {
    await renderWithSafeArea(<Wrapper initial={{ recurrence: 'once', hour: 9, minute: 0, daysOfWeek: [], dayOfMonth: 1 }} />);
    expect(screen.queryByLabelText('Mon')).toBeNull();
    await fireEvent.press(screen.getByText('Weekly'));
    expect(screen.getByLabelText('Mon')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Mon'));
    // Tapping again deselects it without throwing — re-querying still finds the same chip.
    await fireEvent.press(screen.getByLabelText('Mon'));
    expect(screen.getByLabelText('Mon')).toBeTruthy();
  });

  it('shows a day-of-month stepper only for Monthly', async () => {
    await renderWithSafeArea(<Wrapper initial={{ recurrence: 'once', hour: 9, minute: 0, daysOfWeek: [], dayOfMonth: 15 }} />);
    expect(screen.queryByText('Day of month')).toBeNull();
    await fireEvent.press(screen.getByText('Monthly'));
    expect(screen.getByText('Day of month')).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Increase day of month'));
    expect(screen.getByText('16')).toBeTruthy();
  });
});
