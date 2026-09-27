import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { StatusPhotoViewer } from '../StatusPhotoViewer';
import type { ThrowStory } from '../../../types/story';

jest.mock('expo-video', () => ({ useVideoPlayer: () => ({}), VideoView: () => null }));

function photo(id: string): ThrowStory {
  return { id, userId: 'me', mediaUrl: `https://example.com/${id}.jpg`, mediaType: 'photo', trimStartMs: null, trimEndMs: null, createdAt: new Date().toISOString() };
}

describe('StatusPhotoViewer auto-advance', () => {
  it('a single photo just stays — no timer, no call to onExit', async () => {
    const onExit = jest.fn();
    await render(<StatusPhotoViewer stories={[photo('a')]} onExit={onExit} />);
    expect(screen.getByTestId('status-photo-image').props.source.uri).toBe('https://example.com/a.jpg');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 6000));
    });
    expect(screen.getByTestId('status-photo-image').props.source.uri).toBe('https://example.com/a.jpg');
    expect(onExit).not.toHaveBeenCalled();
  }, 10000);

  it('advances through multiple photos every 5s and stops at the last one (no auto-exit, no loop)', async () => {
    const onExit = jest.fn();
    const stories = [photo('a'), photo('b'), photo('c')];
    await render(<StatusPhotoViewer stories={stories} onExit={onExit} />);
    const currentSrc = () => screen.getByTestId('status-photo-image').props.source.uri;

    expect(currentSrc()).toBe('https://example.com/a.jpg');

    await act(async () => {
      await new Promise((r) => setTimeout(r, 5300));
    });
    expect(currentSrc()).toBe('https://example.com/b.jpg');

    await act(async () => {
      await new Promise((r) => setTimeout(r, 5300));
    });
    expect(currentSrc()).toBe('https://example.com/c.jpg');

    // On the last photo now — no further auto-advance, and definitely no auto-exit; only a
    // manual swipe past this point calls onExit (see the component's own PanResponder).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 6000));
    });
    expect(currentSrc()).toBe('https://example.com/c.jpg');
    expect(onExit).not.toHaveBeenCalled();
  }, 20000);
});
