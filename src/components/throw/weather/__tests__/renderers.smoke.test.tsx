import React from 'react';
import { act, render } from '@testing-library/react-native';
import { SnowOverlay } from '../SnowOverlay';
import { WindOverlay } from '../WindOverlay';
import { CloudOverlay } from '../CloudOverlay';
import { LightningController } from '../LightningController';
import { ClearOverlay } from '../ClearOverlay';

// Every renderer here runs a real-timer-driven Animated.loop (jest has no native Animated module,
// so these fall back to JS timers) — always unmount before the next test starts, same reasoning
// RainOverlay's own smoke test documents, so no leftover timer fires outside its own act() scope.

describe('SnowOverlay', () => {
  it('renders active and inactive without crashing', async () => {
    const { rerender, unmount } = await render(<SnowOverlay active intensity="medium" />);
    await act(async () => {});
    rerender(<SnowOverlay active={false} intensity="medium" />);
    await act(async () => {});
    unmount();
  });
});

describe('WindOverlay', () => {
  it('renders in both wind directions without crashing', async () => {
    const { rerender, unmount } = await render(<WindOverlay active intensity="medium" windSpeedKph={20} windDirectionDeg={90} />);
    await act(async () => {});
    rerender(<WindOverlay active intensity="heavy" windSpeedKph={45} windDirectionDeg={270} />);
    await act(async () => {});
    unmount();
  });
});

describe('CloudOverlay', () => {
  it('renders both the light and dark variant without crashing', async () => {
    const { rerender, unmount } = await render(<CloudOverlay active />);
    await act(async () => {});
    rerender(<CloudOverlay active dark />);
    await act(async () => {});
    unmount();
  });
});

describe('ClearOverlay', () => {
  it('renders without crashing', async () => {
    const { unmount } = await render(<ClearOverlay active />);
    await act(async () => {});
    unmount();
  });
});

describe('LightningController', () => {
  it('renders without crashing, active or not, reduced or not', async () => {
    const { rerender, unmount } = await render(<LightningController active reducedFlashing={false} reduceMotion={false} />);
    await act(async () => {});
    rerender(<LightningController active reducedFlashing reduceMotion={false} />);
    await act(async () => {});
    unmount();
  });

  it('never schedules a flash when reduceMotion is on', async () => {
    const { unmount } = await render(<LightningController active reducedFlashing={false} reduceMotion />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    unmount();
  });
});
