import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { ContactStoryStack } from '../ContactStoryStack';
import type { ThrowStory } from '../../../types/story';

jest.mock('expo-video', () => ({ useVideoPlayer: () => ({}), VideoView: () => null }));

function photo(id: string): ThrowStory {
  return { id, userId: 'them', mediaUrl: `https://example.com/${id}.jpg`, mediaType: 'photo', trimStartMs: null, trimEndMs: null, createdAt: new Date().toISOString() };
}

describe('ContactStoryStack ordering and lifecycle', () => {
  it('shows the most recently posted story on top, not the oldest', async () => {
    // `stories` itself is always oldest-first (same convention as every other story component in
    // Throw) — 'c' was posted last, so it's the one that should actually be on top/interactive.
    const stories = [photo('a'), photo('b'), photo('c')];
    await render(<ContactStoryStack stories={stories} onExhausted={jest.fn()} />);
    expect(screen.getByTestId('contact-story-image').props.source.uri).toBe('https://example.com/c.jpg');
  });

  it('reports a view for the front story as soon as it is shown', async () => {
    const onViewed = jest.fn();
    const stories = [photo('a'), photo('b')];
    await render(<ContactStoryStack stories={stories} onExhausted={jest.fn()} onViewed={onViewed} />);
    expect(onViewed).toHaveBeenCalledWith('b');
    expect(onViewed).toHaveBeenCalledTimes(1);
  });

  it('calls onExhausted right away if handed no stories at all', async () => {
    const onExhausted = jest.fn();
    await render(<ContactStoryStack stories={[]} onExhausted={onExhausted} />);
    await act(async () => {});
    expect(onExhausted).toHaveBeenCalledTimes(1);
  });

  it('does not call onExhausted while at least one story is still showing', async () => {
    const onExhausted = jest.fn();
    await render(<ContactStoryStack stories={[photo('a')]} onExhausted={onExhausted} />);
    await act(async () => {});
    expect(onExhausted).not.toHaveBeenCalled();
  });

  it('behaves identically for your own stories as for anyone else\'s, absent any gesture', async () => {
    // isOwnStories only changes what a long-press/flick-down does and how the stack's own
    // entrance plays — it shouldn't change ordering, onViewed, or onExhausted at all.
    const onViewed = jest.fn();
    const stories = [photo('a'), photo('b')];
    await render(<ContactStoryStack stories={stories} isOwnStories onExhausted={jest.fn()} onViewed={onViewed} />);
    expect(screen.getByTestId('contact-story-image').props.source.uri).toBe('https://example.com/b.jpg');
    expect(onViewed).toHaveBeenCalledWith('b');
  });

  it('never shows the delete overlay without a long press, own stories or not', async () => {
    await render(<ContactStoryStack stories={[photo('a')]} isOwnStories onExhausted={jest.fn()} />);
    expect(screen.queryByTestId('delete-overlay')).toBeNull();
  });
});
