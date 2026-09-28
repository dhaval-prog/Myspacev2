import React from 'react';
import { act, render } from '@testing-library/react-native';
import { RainOverlay } from '../RainOverlay';

describe('RainOverlay (native)', () => {
  it('renders without crashing while active, and while inactive', async () => {
    const { rerender, unmount } = await render(<RainOverlay active intensity="medium" />);
    await act(async () => {});
    rerender(<RainOverlay active={false} intensity="medium" />);
    await act(async () => {});
    // Stops the (real-timer-driven, since jest has no native Animated module) looping fall
    // animation before the next test renders — otherwise its own leftover timers can fire outside
    // that test's own act() scope.
    unmount();
  });

  it('renders more particles at higher quality without crashing', async () => {
    const { unmount } = await render(<RainOverlay active intensity="heavy" quality="high" />);
    await act(async () => {});
    unmount();
  });

  it('accepts a partial RainConfig override', async () => {
    const { unmount } = await render(<RainOverlay active intensity="light" config={{ angle: 15, speed: 1.4, opacity: 0.6, intensity: 1 }} />);
    await act(async () => {});
    unmount();
  });
});
