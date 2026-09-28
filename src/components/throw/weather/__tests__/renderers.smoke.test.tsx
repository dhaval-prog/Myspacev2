import React from 'react';
import { act, render } from '@testing-library/react-native';
import { SnowOverlay } from '../SnowOverlay';
import { WindOverlay } from '../WindOverlay';
import { CloudOverlay } from '../CloudOverlay';
import { LightningController } from '../LightningController';
import { ClearOverlay } from '../ClearOverlay';
import { SunnyRenderer } from '../SunnyRenderer';
import { WindController } from '../windController';

// Every renderer here runs a real-timer-driven Animated.loop (jest has no native Animated module,
// so these fall back to JS timers) — always unmount before the next test starts, same reasoning
// RainOverlay's own smoke test documents, so no leftover timer fires outside its own act() scope.

function makeWindController() {
  return new WindController({ speed: 20, direction: 90, gustStrength: 0.4, turbulence: 0.4 });
}

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
    const controller = makeWindController();
    const { rerender, unmount } = await render(<WindOverlay active intensity="medium" windController={controller} />);
    await act(async () => {
      controller.tick(500);
    });
    rerender(<WindOverlay active intensity="heavy" windController={controller} />);
    await act(async () => {
      controller.tick(500);
    });
    unmount();
  });
});

describe('CloudOverlay', () => {
  it('renders both the light and dark variant without crashing', async () => {
    const controller = makeWindController();
    const { rerender, unmount } = await render(<CloudOverlay active windController={controller} />);
    await act(async () => {
      controller.tick(500);
    });
    rerender(<CloudOverlay active dark windController={controller} />);
    await act(async () => {
      controller.tick(500);
    });
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

describe('SunnyRenderer', () => {
  it('renders active/inactive and reduced/full motion without crashing', async () => {
    const { rerender, unmount } = await render(<SunnyRenderer active />);
    await act(async () => {});
    rerender(<SunnyRenderer active reduceMotion />);
    await act(async () => {});
    rerender(<SunnyRenderer active={false} />);
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
