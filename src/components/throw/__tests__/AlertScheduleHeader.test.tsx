import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithSafeArea } from '../../../testUtils/renderWithSafeArea';
import { AlertScheduleHeader } from '../AlertScheduleHeader';
import type { AlertSchedule } from '../../../types/throw';

function Wrapper({ initial }: { initial: AlertSchedule }) {
  const [schedule, setSchedule] = React.useState(initial);
  return <AlertScheduleHeader schedule={schedule} onChange={setSchedule} />;
}

const BASE: AlertSchedule = { recurrence: 'once', hour: 9, minute: 0, daysOfWeek: [], dayOfMonth: 1 };

describe('AlertScheduleHeader', () => {
  it('shows the hour/minute/period wheels and a collapsed Repeat row defaulting to Never', async () => {
    await renderWithSafeArea(<Wrapper initial={BASE} />);
    expect(screen.getByLabelText('Hour 09')).toBeTruthy();
    expect(screen.getByLabelText('Minute 00')).toBeTruthy();
    expect(screen.getByLabelText('Period AM')).toBeTruthy();
    expect(screen.getByText('Repeat')).toBeTruthy();
    expect(screen.getByText('Never')).toBeTruthy();
    expect(screen.queryByText('Every Day')).toBeNull();
  });

  it('tapping an hour value reports it in 24-hour form, keeping AM/PM', async () => {
    const onChange = jest.fn();
    await renderWithSafeArea(<AlertScheduleHeader schedule={BASE} onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('Hour 10'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hour: 10 }));
  });

  it('tapping a minute value updates the schedule', async () => {
    const onChange = jest.fn();
    await renderWithSafeArea(<AlertScheduleHeader schedule={BASE} onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('Minute 45'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minute: 45 }));
  });

  it('tapping PM flips the hour into the afternoon without changing the hour-of-12 shown', async () => {
    const onChange = jest.fn();
    await renderWithSafeArea(<AlertScheduleHeader schedule={{ ...BASE, hour: 9 }} onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('Period PM'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hour: 21 }));
  });

  it('expands the Repeat row into an options list, and selecting one collapses it again', async () => {
    await renderWithSafeArea(<Wrapper initial={BASE} />);
    await fireEvent.press(screen.getByText('Repeat'));
    expect(screen.getByText('Every Day')).toBeTruthy();
    expect(screen.getByText('Weekly')).toBeTruthy();
    expect(screen.getByText('Monthly')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Weekly'));
    // Collapsed again — only the row's own value text remains, not the options list.
    expect(screen.queryByText('Every Day')).toBeNull();
    expect(screen.getAllByText('Weekly').length).toBe(1);
  });

  it('shows a weekday picker only for Weekly, and toggles a day on tap', async () => {
    await renderWithSafeArea(<Wrapper initial={BASE} />);
    expect(screen.queryByLabelText('Mon')).toBeNull();
    await fireEvent.press(screen.getByText('Repeat'));
    await fireEvent.press(screen.getByLabelText('Weekly'));
    expect(screen.getByLabelText('Mon')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Mon'));
    await fireEvent.press(screen.getByLabelText('Mon'));
    expect(screen.getByLabelText('Mon')).toBeTruthy();
  });

  it('shows a day-of-month stepper only for Monthly', async () => {
    await renderWithSafeArea(<Wrapper initial={{ ...BASE, dayOfMonth: 15 }} />);
    expect(screen.queryByText('Day of month')).toBeNull();
    await fireEvent.press(screen.getByText('Repeat'));
    await fireEvent.press(screen.getByLabelText('Monthly'));
    expect(screen.getByText('Day of month')).toBeTruthy();
    expect(screen.getByLabelText('day of month: 15')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Increase day of month'));
    expect(screen.getByLabelText('day of month: 16')).toBeTruthy();
  });
});
