import React from 'react';
import { render, screen } from '@testing-library/react-native';
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

  it('draws one solid, ungapped circle for a single active story', async () => {
    await render(
      <StoryRing count={1} size={64}>
        <Text>avatar</Text>
      </StoryRing>,
    );
    const circle = screen.getByTestId('story-ring-circle');
    expect(circle.props.strokeDasharray).toBeUndefined();
  });

  it('splits the ring into that many equal (dash, gap) segments for more than one story', async () => {
    await render(
      <StoryRing count={3} size={64}>
        <Text>avatar</Text>
      </StoryRing>,
    );
    const circle = screen.getByTestId('story-ring-circle');
    // react-native-svg normalizes a "X Y" strokeDasharray string prop into a parsed array by the
    // time it reaches the rendered host node, rather than preserving the original string — handle
    // both shapes rather than assuming which one `.props` exposes.
    const raw = circle.props.strokeDasharray;
    const [segment, gap] = (Array.isArray(raw) ? raw : String(raw).split(/[\s,]+/)).map(Number);
    const radius = circle.props.r;
    const circumference = 2 * Math.PI * radius;
    // Three [segment, gap] pairs must tile the whole circumference exactly, since that's what
    // makes a single repeating dash pattern draw exactly `count` evenly-spaced arcs.
    expect(segment * 3 + gap * 3).toBeCloseTo(circumference, 5);
    expect(gap).toBe(6);
  });
});
