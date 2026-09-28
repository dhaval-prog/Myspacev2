import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Animated } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MyStatusPanel } from '../MyStatusPanel';
import type { CarouselPosCore } from '../../../hooks/useCarouselPos';
import type { ThrowStory } from '../../../types/story';

jest.mock('expo-video', () => ({ useVideoPlayer: () => ({ addListener: () => ({ remove: () => {} }) }), VideoView: () => null }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

let mockContactStoryStackProps: any;
jest.mock('../ContactStoryStack', () => ({
  ContactStoryStack: (props: any) => {
    mockContactStoryStackProps = props;
    return null;
  },
}));

const mockCamera = {
  renderPreview: jest.fn(() => null),
  facingIsUser: true,
  flip: jest.fn(),
  denied: false,
  live: true,
  warm: jest.fn(),
  cool: jest.fn(),
  takePhoto: jest.fn().mockResolvedValue('file:///photo.jpg'),
  startRecording: jest.fn(),
  stopRecording: jest.fn().mockResolvedValue({ uri: 'file:///video.mp4', durationMs: 3000 }),
  canRecordVideo: true,
};
jest.mock('../useStatusCamera', () => ({ useStatusCamera: () => mockCamera }));

function fakeCore(index = -1): CarouselPosCore {
  return {
    pos: new Animated.Value(index),
    index,
    springTo: jest.fn(),
    beginDrag: jest.fn(),
    updateDrag: jest.fn(),
    endDrag: jest.fn(),
  };
}

function baseProps(overrides: Partial<React.ComponentProps<typeof MyStatusPanel>> = {}) {
  const stories: ThrowStory[] = [];
  return {
    core: fakeCore(),
    flightTargetX: 195,
    flightTargetY: 97,
    stories,
    dropSignal: 0,
    onDeleteStory: jest.fn(),
    onAvatarCountChange: jest.fn(),
    onPulseAvatar: jest.fn(),
    postStory: jest.fn().mockResolvedValue({ error: null }),
    onClose: jest.fn(),
    ...overrides,
  };
}

async function wait(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

// Polls in small real-time steps until `predicate` is true, instead of a single fixed-length
// wait — the morph animation's real-world completion time can stretch well past its nominal
// duration under a slow/CPU-constrained test runner, so a generous fixed wait can still be too
// short. Bails out (leaving the last assertion to report the real failure) after `timeoutMs`.
async function waitUntil(predicate: () => boolean, timeoutMs = 5000, stepMs = 100) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    await wait(stepMs);
  }
}

// The panel now enters through an explicit CAMERA_ENTERING phase (preview fade-in, then staggered
// controls) before the shutter/gallery/close buttons' own onShutterPressIn guard (`phase === 'idle'`)
// will actually arm — every test presses those only after this settles, matching how a real press
// can't land mid-entrance either.
async function waitForEnter() {
  await wait(350);
}
// Covers CAMERA_FLASH (350ms) + MEDIA_REVIEW_ENTERING (300ms) after a capture, before the review
// pill/buttons are live.
async function waitForReviewAfterCapture() {
  await wait(700);
}
// Covers CAMERA_RECORDING_STOPPING (220ms) + MEDIA_REVIEW_ENTERING (300ms) after releasing a
// recording.
async function waitForReviewAfterRecording() {
  await wait(600);
}
// Covers MEDIA_REVIEW_ENTERING (300ms) for a gallery pick, which skips the press/flash stages.
async function waitForReviewAfterGalleryPick() {
  await wait(350);
}
// Covers MEDIA_RETAKING (260ms) back to CAMERA_IDLE.
async function waitForRetake() {
  await wait(320);
}

describe('MyStatusPanel capture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCamera.denied = false;
    mockCamera.live = true;
    mockCamera.canRecordVideo = true;
    mockCamera.takePhoto.mockResolvedValue('file:///photo.jpg');
    mockCamera.stopRecording.mockResolvedValue({ uri: 'file:///video.mp4', durationMs: 3000 });
  });

  it('shows the close and gallery buttons over the live preview before any capture', async () => {
    await render(<MyStatusPanel {...baseProps()} />);
    await waitForEnter();
    expect(screen.getByLabelText('Close camera')).toBeTruthy();
    expect(screen.getByLabelText('Choose photo or video from library')).toBeTruthy();
  });

  it('calls onClose when the close button is pressed', async () => {
    const onClose = jest.fn();
    await render(<MyStatusPanel {...baseProps({ onClose })} />);
    await waitForEnter();
    fireEvent.press(screen.getByLabelText('Close camera'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a quick tap on the shutter takes a photo and shows the review pill', async () => {
    await render(<MyStatusPanel {...baseProps()} />);
    await waitForEnter();
    const shutter = screen.getByLabelText('Hold to record video, tap for a photo');
    // pressIn and pressOut each get their own act() so the state update from each genuinely
    // flushes before the next fires — a bare fireEvent mid-block can otherwise leave the phase
    // update pending until well after this block returns (confirmed empirically: without this
    // split, onShutterPressOut can still read the pre-press phase).
    await act(async () => {
      fireEvent(shutter, 'pressIn');
    });
    await wait(50);
    await act(async () => {
      fireEvent(shutter, 'pressOut');
    });
    // Covers CAMERA_FLASH + MEDIA_REVIEW_ENTERING running to completion for real before the test
    // ends and unmounts — otherwise left mid-flight, and react-native's own Animated.timing
    // invokes its completion callback (with finished: false) when stopAnimation() cuts it off on
    // unmount, which can bleed act() warnings into whichever test runs next.
    await waitForReviewAfterCapture();
    expect(mockCamera.takePhoto).toHaveBeenCalledTimes(1);
    expect(mockCamera.startRecording).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Add to your status')).toBeTruthy();
  });

  it('holding past the hold threshold starts recording instead of taking a photo', async () => {
    await render(<MyStatusPanel {...baseProps()} />);
    await waitForEnter();
    const shutter = screen.getByLabelText('Hold to record video, tap for a photo');
    await act(async () => {
      fireEvent(shutter, 'pressIn');
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    expect(mockCamera.startRecording).toHaveBeenCalledTimes(1);
    expect(mockCamera.takePhoto).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent(shutter, 'pressOut');
    });
    // Covers CAMERA_RECORDING_STOPPING + MEDIA_REVIEW_ENTERING running to completion.
    await waitForReviewAfterRecording();
    expect(mockCamera.stopRecording).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Add to your status')).toBeTruthy();
  });

  it('never arms recording when the camera reports it cannot record video', async () => {
    mockCamera.canRecordVideo = false;
    await render(<MyStatusPanel {...baseProps()} />);
    await waitForEnter();
    const shutter = screen.getByLabelText('Take a photo');
    await act(async () => {
      fireEvent(shutter, 'pressIn');
    });
    await wait(350);
    await act(async () => {
      fireEvent(shutter, 'pressOut');
    });
    // Lets the shutter's flash + review-entrance animation run to completion before the test ends
    // (see the "quick tap" test above for why).
    await waitForReviewAfterCapture();
    expect(mockCamera.startRecording).not.toHaveBeenCalled();
    expect(mockCamera.takePhoto).toHaveBeenCalledTimes(1);
  });

  it('shows the "camera blocked" fallback note when permission is denied, and still lets a capture proceed', async () => {
    mockCamera.denied = true;
    mockCamera.live = false;
    await render(<MyStatusPanel {...baseProps()} />);
    await waitForEnter();
    expect(screen.getByText('Camera blocked · sample preview')).toBeTruthy();

    const shutter = screen.getByLabelText('Hold to record video, tap for a photo');
    await act(async () => {
      fireEvent(shutter, 'pressIn');
    });
    await wait(50);
    await act(async () => {
      fireEvent(shutter, 'pressOut');
    });
    // Lets the shutter's flash + review-entrance animation run to completion before the test ends.
    await waitForReviewAfterCapture();
    expect(mockCamera.takePhoto).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Add to your status')).toBeTruthy();
  });

  it('retake discards the review without ever calling postStory', async () => {
    const postStory = jest.fn().mockResolvedValue({ error: null });
    await render(<MyStatusPanel {...baseProps({ postStory })} />);
    await waitForEnter();
    const shutter = screen.getByLabelText('Hold to record video, tap for a photo');
    await act(async () => {
      fireEvent(shutter, 'pressIn');
    });
    await wait(50);
    await act(async () => {
      fireEvent(shutter, 'pressOut');
    });
    await waitForReviewAfterCapture();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Retake'));
    });
    await waitForRetake();
    expect(postStory).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Add to your status')).toBeNull();
    expect(screen.getByLabelText('Close camera')).toBeTruthy();
  });

  it('"Add to status" posts the captured photo and pulses the avatar once the morph finishes', async () => {
    const postStory = jest.fn().mockResolvedValue({ error: null });
    const onPulseAvatar = jest.fn();
    await render(<MyStatusPanel {...baseProps({ postStory, onPulseAvatar })} />);
    await waitForEnter();
    const shutter = screen.getByLabelText('Hold to record video, tap for a photo');
    await act(async () => {
      fireEvent(shutter, 'pressIn');
    });
    await wait(50);
    await act(async () => {
      fireEvent(shutter, 'pressOut');
    });
    await waitForReviewAfterCapture();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Add to your status'));
    });
    expect(postStory).toHaveBeenCalledWith('file:///photo.jpg', 'photo', undefined);

    await waitUntil(() => onPulseAvatar.mock.calls.length > 0);
    expect(onPulseAvatar).toHaveBeenCalledTimes(1);
    // STATUS_ADDED still has to settle back through CAMERA_ENTERING before the camera controls
    // (including "Close camera") reappear — onPulseAvatar firing only marks STATUS_ADDED itself.
    await waitUntil(() => screen.queryByLabelText('Close camera') !== null);
    expect(screen.getByLabelText('Close camera')).toBeTruthy();
    expect(screen.queryByLabelText('Add to your status')).toBeNull();
  });

  it('a gallery video over 15s is posted with a trim window to the first 15s', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ type: 'video', uri: 'file:///long.mp4', duration: 22000 }],
    });
    const postStory = jest.fn().mockResolvedValue({ error: null });
    await render(<MyStatusPanel {...baseProps({ postStory })} />);
    await waitForEnter();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Choose photo or video from library'));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await waitForReviewAfterGalleryPick();

    expect(screen.getByText('Trimmed to the first 15s')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Add to your status'));
    });
    expect(postStory).toHaveBeenCalledWith('file:///long.mp4', 'video', { startMs: 0, endMs: 15000 });
    // Lets the "add to status" morph animation run to completion before the test ends — otherwise
    // it's still in flight when the component unmounts.
    await waitUntil(() => screen.queryByLabelText('Add to your status') === null);
  });

  it('a gallery photo skips review-video machinery and posts as a plain photo', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ type: 'image', uri: 'file:///pic.jpg' }],
    });
    const postStory = jest.fn().mockResolvedValue({ error: null });
    await render(<MyStatusPanel {...baseProps({ postStory })} />);
    await waitForEnter();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Choose photo or video from library'));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await waitForReviewAfterGalleryPick();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Add to your status'));
    });
    expect(postStory).toHaveBeenCalledWith('file:///pic.jpg', 'photo', undefined);
    await waitUntil(() => screen.queryByLabelText('Add to your status') === null);
  });
});

describe('MyStatusPanel own-status overlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContactStoryStackProps = undefined;
  });

  it('always mounts ContactStoryStack for its own stories, marked own-stories and empty-state-hidden', async () => {
    const stories: ThrowStory[] = [
      { id: 's0', userId: 'me', mediaUrl: 'https://example.com/0.jpg', mediaType: 'photo', trimStartMs: null, trimEndMs: null, createdAt: new Date().toISOString() },
    ];
    await render(<MyStatusPanel {...baseProps({ stories, dropSignal: 3 })} />);

    expect(mockContactStoryStackProps.stories).toBe(stories);
    expect(mockContactStoryStackProps.isOwnStories).toBe(true);
    expect(mockContactStoryStackProps.hideEmptyState).toBe(true);
    expect(mockContactStoryStackProps.dropSignal).toBe(3);
  });
});
