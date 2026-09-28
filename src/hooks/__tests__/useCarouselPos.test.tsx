import React from 'react';
import { act, render } from '@testing-library/react-native';
import { useCarouselPos, type CarouselPosCore } from '../useCarouselPos';

function Harness({ onSettle, onCore }: { onSettle: (index: number) => void; onCore: (core: CarouselPosCore) => void }) {
  const core = useCarouselPos({ min: -1, max: 2, initial: 0, onSettle });
  // Reports on every render (not just the first) — `core.index` is a plain snapshot value, not a
  // live binding, so the test's own reference needs refreshing after every state update or it'd
  // keep reading whatever `index` happened to be at first mount.
  onCore(core);
  return null;
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 700));
  });
}

// Animated.Value's own current number, read via its documented-internal (but stable, and already
// used the same way elsewhere in RN codebases for exactly this purpose) __getValue accessor —
// there's no public API for a synchronous read.
function posValue(core: CarouselPosCore): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (core.pos as any).__getValue();
}

describe('useCarouselPos', () => {
  it('commits the clamped target synchronously and fires onSettle', async () => {
    const onSettle = jest.fn();
    let core!: CarouselPosCore;
    await render(<Harness onSettle={onSettle} onCore={(c) => (core = c)} />);

    await act(async () => {
      core.springTo(5);
    });
    expect(onSettle).toHaveBeenCalledWith(2);
    expect(core.index).toBe(2);
    await settle();
  });

  it('never fires onSettle when the target is unchanged', async () => {
    const onSettle = jest.fn();
    let core!: CarouselPosCore;
    await render(<Harness onSettle={onSettle} onCore={(c) => (core = c)} />);

    await act(async () => {
      core.springTo(0);
    });
    expect(onSettle).not.toHaveBeenCalled();
    await settle();
  });

  it('clamps below min too (e.g. "You" at -1 is the floor)', async () => {
    const onSettle = jest.fn();
    let core!: CarouselPosCore;
    await render(<Harness onSettle={onSettle} onCore={(c) => (core = c)} />);

    await act(async () => {
      core.springTo(-10);
    });
    expect(onSettle).toHaveBeenCalledWith(-1);
    await settle();
  });

  it('a fresh springTo mid-flight catches the position where it currently is, not the old target', async () => {
    const onSettle = jest.fn();
    let core!: CarouselPosCore;
    await render(<Harness onSettle={onSettle} onCore={(c) => (core = c)} />);

    await act(async () => {
      core.springTo(2);
    });
    // Redirect almost immediately, before the first spring has any chance to settle — this should
    // not throw, and should commit the new target right away.
    await act(async () => {
      core.springTo(0);
    });
    expect(core.index).toBe(0);
    await settle();
    expect(posValue(core)).toBeCloseTo(0, 1);
  });

  it('drag follows the finger 1:1 within range, with resistance past the ends', async () => {
    const onSettle = jest.fn();
    let core!: CarouselPosCore;
    await render(<Harness onSettle={onSettle} onCore={(c) => (core = c)} />);

    const UNIT = 100;
    await act(async () => {
      core.beginDrag();
      // Dragging left (negative dx) moves pos forward (toward higher indices) — matches
      // RecipientCarousel's own itemTransform convention (translateX = (i - pos) * SP).
      core.updateDrag(-50, 0, UNIT);
    });
    expect(posValue(core)).toBeCloseTo(0.5, 5);

    await act(async () => {
      // Way past the last real index (2) — should be heavily damped (resistance), not 1:1.
      core.updateDrag(-500, 0, UNIT);
    });
    const overshoot = posValue(core);
    expect(overshoot).toBeLessThan(5); // raw (unresisted) would be 5; resistance pulls it well under.
    expect(overshoot).toBeGreaterThan(2);
  });

  it('a fast flick commits to the next index even without reaching the halfway point', async () => {
    const onSettle = jest.fn();
    let core!: CarouselPosCore;
    await render(<Harness onSettle={onSettle} onCore={(c) => (core = c)} />);

    await act(async () => {
      core.beginDrag();
      core.updateDrag(-20, 0, 100); // only 0.2 of the way toward index 1
      core.endDrag(-0.5, 100); // fast leftward flick (px/ms), well past the 0.3 threshold
    });
    expect(onSettle).toHaveBeenCalledWith(1);
    await settle();
  });

  it('a slow drag short of the midpoint snaps back to the nearest (starting) index', async () => {
    const onSettle = jest.fn();
    let core!: CarouselPosCore;
    await render(<Harness onSettle={onSettle} onCore={(c) => (core = c)} />);

    await act(async () => {
      core.beginDrag();
      core.updateDrag(-20, 0, 100); // 0.2 of the way — closer to 0 than to 1
      core.endDrag(-0.05, 100); // slow release, under the flick threshold
    });
    expect(onSettle).not.toHaveBeenCalled();
    await settle();
  });
});
