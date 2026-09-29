import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StoryPreviewScreen } from '../StoryPreviewScreen';

jest.mock('expo-video', () => ({ useVideoPlayer: () => ({}), VideoView: () => null }));

describe('StoryPreviewScreen', () => {
  it('discards immediately on close, without ever calling onConfirm', async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    await render(<StoryPreviewScreen localUri="file:///a.jpg" mediaType="photo" onCancel={onCancel} onConfirm={onConfirm} />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Retake'));
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('only calls onConfirm once the fly-to-ring animation finishes, not immediately on tap', async () => {
    const onConfirm = jest.fn();
    await render(<StoryPreviewScreen localUri="file:///a.jpg" mediaType="photo" onCancel={jest.fn()} onConfirm={onConfirm} />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Add to status'));
    });
    expect(onConfirm).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 700));
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  }, 10000);

  it('hides the close/confirm controls once the flight starts', async () => {
    await render(<StoryPreviewScreen localUri="file:///a.jpg" mediaType="photo" onCancel={jest.fn()} onConfirm={jest.fn()} />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Add to status'));
    });

    expect(screen.queryByLabelText('Retake')).toBeNull();
    expect(screen.queryByLabelText('Add to status')).toBeNull();

    // Let the flight animation finish so nothing is left running into the next test.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 700));
    });
  }, 10000);
});
