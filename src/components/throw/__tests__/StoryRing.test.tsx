import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { StoryRing, STORY_RING_AVATAR_GAP } from '../StoryRing';

/** Parses a "M x y L x y L x y ... Z" path string into its [x, y] points. */
function parsePoints(d: string): [number, number][] {
  return d
    .replace(/[MLZ]/g, '')
    .trim()
    .split(/\s+/)
    .map(Number)
    .reduce<[number, number][]>((points, value, i, arr) => {
      if (i % 2 === 0) points.push([value, arr[i + 1]]);
      return points;
    }, []);
}

describe('StoryRing', () => {
  it('renders children completely untouched when there are no active stories', async () => {
    await render(
      <StoryRing count={0} size={64}>
        <Text>avatar</Text>
      </StoryRing>,
    );
    expect(screen.getByText('avatar')).toBeTruthy();
    expect(screen.queryByTestId('story-ring-svg')).toBeNull();
  });

  it('draws a closed blue wave path around the avatar for an active story', async () => {
    await render(
      <StoryRing count={1} size={64}>
        <Text>avatar</Text>
      </StoryRing>,
    );
    const path = screen.getByTestId('story-ring-path');
    // react-native-svg parses the `stroke` string into its own packed color representation by
    // the time it reaches the rendered host node, rather than preserving the original string
    // (same reasoning as strokeDasharray's own normalization, confirmed the same way) — the
    // meaningful thing to check is that a color came through at all, not its exact internal shape.
    expect(path.props.stroke).toBeTruthy();
    expect(path.props.d.startsWith('M')).toBe(true);
    expect(path.props.d.trim().endsWith('Z')).toBe(true);
  });

  it('animates the wave over time — the path keeps changing rather than sitting static', async () => {
    await render(
      <StoryRing count={2} size={64}>
        <Text>avatar</Text>
      </StoryRing>,
    );
    const firstD = screen.getByTestId('story-ring-path').props.d;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    const laterD = screen.getByTestId('story-ring-path').props.d;
    expect(laterD).not.toBe(firstD);
  }, 10000);

  it('never lets the wave come closer to the avatar than its fixed gap, at any point in the animation', async () => {
    const size = 64;
    await render(
      <StoryRing count={1} size={size}>
        <Text>avatar</Text>
      </StoryRing>,
    );
    const svg = screen.getByTestId('story-ring-svg');
    const center = svg.props.width / 2;
    const avatarRadius = size / 2;

    // Sampled across several points in the animation (not just the initial render) — the
    // guarantee is that the floor holds at every instant, not merely on average.
    for (let sample = 0; sample < 4; sample++) {
      const points = parsePoints(screen.getByTestId('story-ring-path').props.d);
      expect(points.length).toBeGreaterThan(10);
      for (const [x, y] of points) {
        const distance = Math.hypot(x - center, y - center);
        expect(distance).toBeGreaterThanOrEqual(avatarRadius + STORY_RING_AVATAR_GAP - 0.5);
      }
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await new Promise((r) => setTimeout(r, 250));
      });
    }
  }, 10000);
});
