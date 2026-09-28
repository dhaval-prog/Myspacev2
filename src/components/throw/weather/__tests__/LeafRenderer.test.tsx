import React from 'react';
import { act, render } from '@testing-library/react-native';
import { LeafRenderer } from '../LeafRenderer';
import { WindController } from '../windController';

function makeWindController() {
  return new WindController({ speed: 25, direction: 45, gustStrength: 0.5, turbulence: 0.5 });
}

describe('LeafRenderer', () => {
  it('renders without crashing while active, and while inactive', async () => {
    const controller = makeWindController();
    const { rerender, unmount } = await render(<LeafRenderer active intensity="medium" windController={controller} />);
    await act(async () => {
      controller.tick(500);
    });
    rerender(<LeafRenderer active={false} intensity="medium" windController={controller} />);
    await act(async () => {
      controller.tick(500);
    });
    unmount();
  });

  it('spawns and ages leaves over many ticks without crashing, across quality/intensity tiers', async () => {
    const controller = makeWindController();
    const { rerender, unmount } = await render(<LeafRenderer active intensity="heavy" quality="high" windController={controller} />);
    await act(async () => {
      // Enough ticks to spawn several leaves (spawn interval is randomized 800ms–3000ms) and carry
      // at least one through its full fade-in/flying/fade-out lifecycle (lifetime 4500–9000ms).
      for (let i = 0; i < 300; i++) controller.tick(100);
    });
    rerender(<LeafRenderer active intensity="light" quality="low" windController={controller} />);
    await act(async () => {
      for (let i = 0; i < 50; i++) controller.tick(100);
    });
    unmount();
  });

  it('reacts to a gust without crashing', async () => {
    const controller = makeWindController();
    const { unmount } = await render(<LeafRenderer active intensity="medium" windController={controller} />);
    await act(async () => {
      // Force well past the maximum gust interval so at least one gust fires during the run.
      for (let i = 0; i < 130; i++) controller.tick(100);
    });
    unmount();
  });
});
