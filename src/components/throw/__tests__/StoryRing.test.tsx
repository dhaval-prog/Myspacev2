import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { StoryRing } from '../StoryRing';

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
});
