import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { ContactStoryStack } from '../ContactStoryStack';
import type { ThrowStory } from '../../../types/story';

jest.mock('expo-video', () => ({ useVideoPlayer: () => ({}), VideoView: () => null }));

function photo(id: string): ThrowStory {
  return { id, userId: 'them', mediaUrl: `https://example.com/${id}.jpg`, mediaType: 'photo', trimStartMs: null, trimEndMs: null, createdAt: new Date().toISOString() };
}

const baseProps = { contactName: 'Dhaval', flightTargetX: 195, flightTargetY: 97, dropSignal: 1 };

// The tap-avatar drop-in is staggered via real setTimeouts (see ContactStoryStack's own
// dropSignal effect) — waiting for real wall-clock time here rather than fake timers, since the
// per-card Animated.timing driving the visual morph relies on RN's own jest-preset timer shim,
// which fake timers don't reliably drive in lockstep with plain setTimeout.
async function waitForDrops(count: number) {
  // Covers every item's own 190ms stagger delay plus its full 560ms grow-in animation, so no
  // Animated update lands after this resolves (see ContactStoryStack's own DROP_STAGGER_MS/
  // DROP_DURATION_MS).
  const ms = Math.max(count - 1, 0) * 190 + 560 + 150;
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

describe('ContactStoryStack drop-in and empty states', () => {
  it('shows the most recently posted story on top after the tap-avatar drop-in finishes', async () => {
    // `stories` itself is always oldest-first (same convention as every other story component in
    // Throw) — 'c' was posted last, so dropping most-recent-first should land it on top.
    const stories = [photo('a'), photo('b'), photo('c')];
    await render(<ContactStoryStack {...baseProps} stories={stories} />);
    await waitForDrops(3);
    expect(screen.getByTestId('contact-story-image').props.source.uri).toBe('https://example.com/c.jpg');
  });

  it('reports a view for each story as it lands in the letter', async () => {
    const onViewed = jest.fn();
    const stories = [photo('a'), photo('b')];
    await render(<ContactStoryStack {...baseProps} stories={stories} onViewed={onViewed} />);
    await waitForDrops(2);
    expect(onViewed).toHaveBeenCalledWith('b');
    expect(onViewed).toHaveBeenCalledWith('a');
    expect(onViewed).toHaveBeenCalledTimes(2);
  });

  it('shows "No status yet" when handed no stories at all', async () => {
    await render(<ContactStoryStack {...baseProps} stories={[]} />);
    expect(screen.getByText('No status yet')).toBeTruthy();
  });

  it('reports how many photos are still in the avatar as they drop into the letter', async () => {
    const onAvatarCountChange = jest.fn();
    const stories = [photo('a'), photo('b')];
    await render(<ContactStoryStack {...baseProps} stories={stories} onAvatarCountChange={onAvatarCountChange} />);
    // Starts at the full count before any drop has landed.
    expect(onAvatarCountChange).toHaveBeenCalledWith(2);
    await waitForDrops(2);
    expect(onAvatarCountChange).toHaveBeenLastCalledWith(0);
  });

  it('behaves identically for your own stories as for anyone else\'s, absent any gesture', async () => {
    const onViewed = jest.fn();
    const stories = [photo('a'), photo('b')];
    await render(<ContactStoryStack {...baseProps} stories={stories} isOwnStories onViewed={onViewed} />);
    await waitForDrops(2);
    expect(screen.getByTestId('contact-story-image').props.source.uri).toBe('https://example.com/b.jpg');
    expect(onViewed).toHaveBeenCalledWith('b');
  });
});
