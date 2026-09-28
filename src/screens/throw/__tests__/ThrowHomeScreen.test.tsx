import React from 'react';
import { act, screen } from '@testing-library/react-native';
import { renderWithSafeArea } from '../../../testUtils/renderWithSafeArea';
import { ThrowHomeScreen } from '../ThrowHomeScreen';
import { useAuth } from '../../../context/AuthContext';
import { useThrow } from '../../../context/ThrowContext';
import { useThrowAlerts } from '../../../context/ThrowAlertsContext';
import { useGameStats } from '../../../context/GameStatsContext';
import { useThrowColorMode } from '../../../context/ThrowColorModeContext';
import { useThrowStories } from '../../../context/ThrowStoriesContext';

jest.mock('../../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../context/ThrowContext', () => ({ useThrow: jest.fn() }));
jest.mock('../../../context/ThrowAlertsContext', () => ({ useThrowAlerts: jest.fn() }));
jest.mock('../../../context/GameStatsContext', () => ({ useGameStats: jest.fn() }));
jest.mock('../../../context/ThrowColorModeContext', () => ({ useThrowColorMode: jest.fn() }));
jest.mock('../../../context/ThrowStoriesContext', () => ({ useThrowStories: jest.fn() }));

// expo-video has no jest/native-module fallback the way most other Expo packages here do (it
// throws at import time in this test environment) — only StoryTrimScreen/ContactStoryStack touch
// it, and neither renders in these tests, but the bare `import` still runs at module-load time
// through ThrowHomeScreen's own import of them, so this has to be mocked regardless.
jest.mock('expo-video', () => ({ useVideoPlayer: () => ({}), VideoView: () => null }));

// Never exercised by the earlier describe block below (flight state stays null there), but the
// new flight/chrome tests do reach it — a passthrough stub keeps this file's existing convention
// of mocking out anything BlurView-backed rather than relying on its native-module test fallback.
jest.mock('../../../components/friends/GlassSurface', () => ({
  GlassSurface: ({ children }: { children?: React.ReactNode }) => children,
}));

// ThrowMap (Leaflet/react-native-maps) and FoldingLetter/RecipientCarousel (Animated
// gestures, a WebGL 3D stage) are heavy and irrelevant to what's under test here — the
// self-reminder contact-lock state machine lives in ThrowHomeScreen itself. Mocking them down
// to prop-capturing stubs lets these tests assert on exactly what ThrowHomeScreen computed and
// passed down, which is what actually matters for this behavior.
let mockThrowMapProps: any;
jest.mock('../../../components/throw/ThrowMap', () => ({
  ThrowMap: (props: any) => {
    mockThrowMapProps = props;
    return null;
  },
}));

let mockFoldingLetterProps: any;
jest.mock('../../../components/throw/FoldingLetter', () => ({
  FoldingLetter: (props: any) => {
    mockFoldingLetterProps = props;
    const { Text } = require('react-native');
    return require('react').createElement(Text, { testID: 'folding-letter' }, props.recipientName);
  },
}));

let mockCarouselProps: any;
jest.mock('../../../components/throw/RecipientCarousel', () => ({
  RecipientCarousel: (props: any) => {
    mockCarouselProps = props;
    const { Text } = require('react-native');
    return require('react').createElement(Text, { testID: 'carousel' }, 'carousel');
  },
}));

let mockContactStoryStackProps: any;
jest.mock('../../../components/throw/ContactStoryStack', () => ({
  ContactStoryStack: (props: any) => {
    mockContactStoryStackProps = props;
    const { Text } = require('react-native');
    return require('react').createElement(Text, { testID: 'contact-story-stack' }, 'stories');
  },
}));

// StoryCaptureScreen resolves to its .native/.web platform file, both of which touch expo-camera
// (or getUserMedia on web) — irrelevant here (these tests only care whether ThrowHomeScreen opens
// the capture modal at all, not what the camera itself does), and this sidesteps needing to mock
// expo-camera/expo-image-picker's native-module surface too.
let mockStoryCaptureProps: any;
jest.mock('../../../components/throw/StoryCaptureScreen', () => ({
  StoryCaptureScreen: (props: any) => {
    mockStoryCaptureProps = props;
    const { Text } = require('react-native');
    return require('react').createElement(Text, { testID: 'story-capture' }, 'capture');
  },
}));

let mockStoryPreviewProps: any;
jest.mock('../../../components/throw/StoryPreviewScreen', () => ({
  StoryPreviewScreen: (props: any) => {
    mockStoryPreviewProps = props;
    const { Text } = require('react-native');
    return require('react').createElement(Text, { testID: 'story-preview' }, 'preview');
  },
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseThrow = useThrow as jest.Mock;
const mockUseThrowAlerts = useThrowAlerts as jest.Mock;
const mockUseGameStats = useGameStats as jest.Mock;
const mockUseThrowColorMode = useThrowColorMode as jest.Mock;
const mockUseThrowStories = useThrowStories as jest.Mock;

const MY_ID = 'me-1';
const FRIEND = { userId: 'friend-1', name: 'Priya', avatarUrl: null, location: { city: 'Pune', country: 'IN', latitude: 18.5, longitude: 73.8 } };
const noop = () => {};

function setupMocks(createAlert = jest.fn().mockResolvedValue({ error: null })) {
  mockUseAuth.mockReturnValue({ user: { id: MY_ID } });
  mockUseThrow.mockReturnValue({
    myLocation: { city: 'Mumbai', country: 'IN', latitude: 19.07, longitude: 72.87 },
    myName: 'Myself',
    myAvatarUrl: null,
    friends: [FRIEND],
    unreadCount: 0,
    streakFor: () => 0,
    sendThrow: jest.fn(),
    uploadPhoto: jest.fn(),
  });
  mockUseThrowAlerts.mockReturnValue({ createAlert });
  mockUseGameStats.mockReturnValue({ statsFor: () => ({ totalPoints: 0 }) });
  mockUseThrowColorMode.mockReturnValue({ mode: 'auto', isDay: true, autoIsDay: true, setMode: jest.fn(), mapMode: 'auto', mapIsDay: true, setMapMode: jest.fn() });
  mockUseThrowStories.mockReturnValue({
    loading: false,
    storiesByUser: {},
    storyCountFor: () => 0,
    postStory: jest.fn().mockResolvedValue({ error: null }),
    markViewed: jest.fn(),
    refresh: jest.fn(),
  });
  return createAlert;
}

async function renderScreen() {
  await renderWithSafeArea(
    <ThrowHomeScreen onOpenExpenses={noop} onOpenChats={noop} onOpenAddFriend={noop} onOpenInbox={noop} onOpenSettings={noop} />,
  );
}

describe('ThrowHomeScreen self-reminder contact lock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFoldingLetterProps = undefined;
    mockCarouselProps = undefined;
    mockThrowMapProps = undefined;
  });

  it('defaults to Myself selected, with an alert schedule and the carousel/pins still enabled', async () => {
    setupMocks();
    await renderScreen();
    expect(mockFoldingLetterProps.recipientName).toBe('Myself');
    expect(mockFoldingLetterProps.alertSchedule).toBeTruthy();
    expect(mockCarouselProps.disabled).toBe(false);
    const friendPin = mockThrowMapProps.pins.find((p: any) => p.id === FRIEND.userId);
    expect(typeof friendPin.onPress).toBe('function');
  });

  it('does not lock the carousel/map pins just from writing (only from touching the schedule)', async () => {
    setupMocks();
    await renderScreen();
    expect(mockCarouselProps.disabled).toBe(false);
    // FoldingLetter no longer gets an onHasContentChange at all — writing shouldn't be able to
    // lock contact-switching any more, per explicit request.
    expect(mockFoldingLetterProps.onHasContentChange).toBeUndefined();
  });

  it('locks once the alert schedule is touched, even with no text written', async () => {
    setupMocks();
    await renderScreen();

    await act(async () => {
      mockFoldingLetterProps.onAlertScheduleChange({ recurrence: 'everyday', hour: 8, minute: 0, daysOfWeek: [], dayOfMonth: 1 });
    });

    expect(mockCarouselProps.disabled).toBe(true);
    expect(mockFoldingLetterProps.alertSchedule).toEqual({ recurrence: 'everyday', hour: 8, minute: 0, daysOfWeek: [], dayOfMonth: 1 });
  });

  it('unlocks again once the reminder is actually created', async () => {
    const createAlert = setupMocks();
    await renderScreen();

    await act(async () => {
      mockFoldingLetterProps.onAlertScheduleChange({ recurrence: 'everyday', hour: 8, minute: 0, daysOfWeek: [], dayOfMonth: 1 });
    });
    expect(mockCarouselProps.disabled).toBe(true);

    await act(async () => {
      await mockFoldingLetterProps.onThrow({ messageText: 'Drink water', strokes: null, penColor: '#4A90D9', photoUris: [] });
    });

    expect(createAlert).toHaveBeenCalled();
    expect(mockCarouselProps.disabled).toBe(false);
  });
});

describe('ThrowHomeScreen flight/chrome behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFoldingLetterProps = undefined;
    mockCarouselProps = undefined;
    mockThrowMapProps = undefined;
  });

  it('goes straight to a delivered confirmation — no separate "flying" phase — then clears it', async () => {
    const createAlert = setupMocks();
    await renderScreen();

    // Folding the letter (see handleFoldProgress) hides BottomNav — mirrors what actually
    // happens right before a throw.
    await act(async () => {
      mockFoldingLetterProps.onFoldProgress(1);
    });
    expect(screen.getByTestId('bottom-nav-wrap').props.pointerEvents).toBe('none');

    await act(async () => {
      await mockFoldingLetterProps.onThrow({ messageText: 'Drink water', strokes: null, penColor: '#4A90D9', photoUris: [] });
    });
    expect(createAlert).toHaveBeenCalled();

    await act(async () => {
      mockFoldingLetterProps.onLaunched();
    });

    // The delivered copy shows immediately — no intermediate "Flying to…"/"Sealing your
    // reminder…" step ever renders, per explicit request that a throw skip the animated flight
    // simulation and just confirm delivery on the same page.
    expect(screen.getByText('Alert set')).toBeTruthy();
    expect(screen.queryByText(/Flying to/)).toBeNull();
    expect(screen.queryByText(/Sealing your reminder/)).toBeNull();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 2000));
    });
    expect(screen.queryByText('Alert set')).toBeNull();
  }, 10000);

  it('restores the bottom nav once the delivered card clears, for the fresh letter that follows', async () => {
    setupMocks();
    await renderScreen();

    await act(async () => {
      mockFoldingLetterProps.onFoldProgress(1);
    });
    expect(screen.getByTestId('bottom-nav-wrap').props.pointerEvents).toBe('none');

    await act(async () => {
      await mockFoldingLetterProps.onThrow({ messageText: 'Drink water', strokes: null, penColor: '#4A90D9', photoUris: [] });
    });
    await act(async () => {
      mockFoldingLetterProps.onLaunched();
    });

    // A brand-new FoldingLetter mounts right after the delivered card clears, starting at fold
    // progress 0 — but nothing re-fires onFoldProgress(0) for it (an Animated.Value's listener
    // never fires for a value it already started at), so without an explicit reset here the
    // bottom nav would otherwise stay hidden on that fresh blank letter.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 2000));
    });
    expect(screen.getByTestId('bottom-nav-wrap').props.pointerEvents).toBe('box-none');
  }, 10000);
});

describe('ThrowHomeScreen Status slot (tilt/flick left past Own Contact)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFoldingLetterProps = undefined;
    mockCarouselProps = undefined;
    mockThrowMapProps = undefined;
    mockContactStoryStackProps = undefined;
    mockStoryCaptureProps = undefined;
  });

  function withStories(count: number) {
    mockUseThrowStories.mockReturnValue({
      loading: false,
      storiesByUser: {
        [MY_ID]: Array.from({ length: count }, (_, i) => ({
          id: `s${i}`,
          userId: MY_ID,
          mediaUrl: `https://example.com/${i}.jpg`,
          mediaType: 'photo',
          trimStartMs: null,
          trimEndMs: null,
          createdAt: new Date().toISOString(),
        })),
      },
      storyCountFor: (userId: string) => (userId === MY_ID ? count : 0),
      postStory: jest.fn().mockResolvedValue({ error: null }),
      markViewed: jest.fn(),
      refresh: jest.fn(),
    });
  }

  it('always opens the capture flow inline once dragged past Own Contact, even with existing stories', async () => {
    setupMocks();
    withStories(2);
    await renderScreen();
    expect(screen.getByTestId('folding-letter')).toBeTruthy();

    await act(async () => {
      mockFoldingLetterProps.onContactDragStart();
      mockFoldingLetterProps.onContactDragOffset(-1);
    });

    // Status is for adding a new story now, not viewing existing ones — those are reached the same
    // way any other contact's stories are, by tapping the already-selected avatar (see the
    // "tap-to-view story" describe block below).
    expect(screen.queryByTestId('folding-letter')).toBeNull();
    expect(screen.queryByTestId('contact-story-stack')).toBeNull();
    expect(screen.getByTestId('story-capture')).toBeTruthy();
  });

  it('opens the same inline capture flow when there is nothing posted yet', async () => {
    setupMocks();
    withStories(0);
    await renderScreen();

    await act(async () => {
      mockFoldingLetterProps.onContactDragStart();
      mockFoldingLetterProps.onContactDragOffset(-1);
    });

    expect(screen.getByTestId('story-capture')).toBeTruthy();
  });

  it('marks the add-story slot as the active selection, and locks the carousel, while capturing', async () => {
    setupMocks();
    withStories(2);
    await renderScreen();

    await act(async () => {
      mockFoldingLetterProps.onContactDragStart();
      mockFoldingLetterProps.onContactDragOffset(-1);
    });

    expect(mockCarouselProps.isAddStorySelected).toBe(true);
    expect(mockCarouselProps.disabled).toBe(true);
  });

  it('returns to the compose letter for Own Contact once the capture flow is closed', async () => {
    setupMocks();
    withStories(1);
    await renderScreen();

    await act(async () => {
      mockFoldingLetterProps.onContactDragStart();
      mockFoldingLetterProps.onContactDragOffset(-1);
    });
    expect(screen.getByTestId('story-capture')).toBeTruthy();
    expect(mockCarouselProps.isAddStorySelected).toBe(true);

    await act(async () => {
      mockStoryCaptureProps.onClose();
    });

    expect(screen.getByTestId('folding-letter')).toBeTruthy();
    expect(screen.queryByTestId('story-capture')).toBeNull();
    expect(mockCarouselProps.isAddStorySelected).toBe(false);
  });
});

describe('ThrowHomeScreen tap-to-view story (any contact, inline in the card)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFoldingLetterProps = undefined;
    mockCarouselProps = undefined;
    mockContactStoryStackProps = undefined;
  });

  function withStoriesFor(userId: string, count: number) {
    mockUseThrowStories.mockReturnValue({
      loading: false,
      storiesByUser: {
        [userId]: Array.from({ length: count }, (_, i) => ({
          id: `s${i}`,
          userId,
          mediaUrl: `https://example.com/${i}.jpg`,
          mediaType: 'photo',
          trimStartMs: null,
          trimEndMs: null,
          createdAt: new Date().toISOString(),
        })),
      },
      storyCountFor: (id: string) => (id === userId ? count : 0),
      postStory: jest.fn().mockResolvedValue({ error: null }),
      markViewed: jest.fn(),
      refresh: jest.fn(),
    });
  }

  it('opens the already-selected contact\'s stories inline, without moving the carousel chrome', async () => {
    setupMocks();
    withStoriesFor(MY_ID, 3);
    await renderScreen();
    expect(screen.getByTestId('folding-letter')).toBeTruthy();

    await act(async () => {
      mockCarouselProps.onOpenStory(MY_ID);
    });

    expect(screen.queryByTestId('folding-letter')).toBeNull();
    expect(screen.getByTestId('contact-story-stack')).toBeTruthy();
    expect(mockContactStoryStackProps.stories).toHaveLength(3);
    // Unlike the drag-into-Status entry point, tapping a normal contact doesn't relocate the
    // carousel's own selection chrome onto the add-story slot — you're still exactly who you were.
    expect(mockCarouselProps.isAddStorySelected).toBe(false);
  });

  it('works identically for a friend, not just Own Contact', async () => {
    setupMocks();
    withStoriesFor(FRIEND.userId, 1);
    await renderScreen();

    await act(async () => {
      mockCarouselProps.onChangeIndex(1);
    });
    await act(async () => {
      mockCarouselProps.onOpenStory(FRIEND.userId);
    });

    expect(screen.getByTestId('contact-story-stack')).toBeTruthy();
    expect(mockContactStoryStackProps.stories).toHaveLength(1);
  });

  it('does nothing for a contact with no active stories', async () => {
    setupMocks();
    withStoriesFor(MY_ID, 0);
    await renderScreen();

    await act(async () => {
      mockCarouselProps.onOpenStory(MY_ID);
    });

    expect(screen.getByTestId('folding-letter')).toBeTruthy();
    expect(screen.queryByTestId('contact-story-stack')).toBeNull();
  });

  it('reveals the compose letter again once the stack reports it has been exhausted', async () => {
    setupMocks();
    withStoriesFor(MY_ID, 1);
    await renderScreen();

    await act(async () => {
      mockCarouselProps.onOpenStory(MY_ID);
    });
    expect(screen.getByTestId('contact-story-stack')).toBeTruthy();

    await act(async () => {
      mockContactStoryStackProps.onExhausted();
    });

    expect(screen.getByTestId('folding-letter')).toBeTruthy();
    expect(screen.queryByTestId('contact-story-stack')).toBeNull();
  });
});

describe('ThrowHomeScreen story post-capture confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCarouselProps = undefined;
    mockStoryCaptureProps = undefined;
    mockStoryPreviewProps = undefined;
  });

  it('shows a preview with a confirm step instead of posting immediately after capture', async () => {
    setupMocks();
    await renderScreen();

    await act(async () => {
      mockCarouselProps.onAddStory();
    });
    expect(screen.getByTestId('story-capture')).toBeTruthy();

    await act(async () => {
      mockStoryCaptureProps.onCaptured('file:///captured.jpg', 'photo');
    });

    expect(screen.queryByTestId('story-capture')).toBeNull();
    expect(screen.getByTestId('story-preview')).toBeTruthy();
    expect(mockStoryPreviewProps.localUri).toBe('file:///captured.jpg');
    expect(mockStoryPreviewProps.mediaType).toBe('photo');
  });

  it('only calls postStory once the preview\'s confirm arrow is tapped', async () => {
    const postStory = jest.fn().mockResolvedValue({ error: null });
    setupMocks();
    mockUseThrowStories.mockReturnValue({
      loading: false,
      storiesByUser: {},
      storyCountFor: () => 0,
      postStory,
      markViewed: jest.fn(),
      refresh: jest.fn(),
    });
    await renderScreen();

    await act(async () => {
      mockCarouselProps.onAddStory();
    });
    await act(async () => {
      mockStoryCaptureProps.onCaptured('file:///captured.jpg', 'photo');
    });
    expect(postStory).not.toHaveBeenCalled();

    await act(async () => {
      mockStoryPreviewProps.onConfirm();
    });

    expect(postStory).toHaveBeenCalledWith('file:///captured.jpg', 'photo');
    expect(screen.queryByTestId('story-preview')).toBeNull();
  });

  it('discards the capture and never calls postStory when the preview is cancelled', async () => {
    const postStory = jest.fn().mockResolvedValue({ error: null });
    setupMocks();
    mockUseThrowStories.mockReturnValue({
      loading: false,
      storiesByUser: {},
      storyCountFor: () => 0,
      postStory,
      markViewed: jest.fn(),
      refresh: jest.fn(),
    });
    await renderScreen();

    await act(async () => {
      mockCarouselProps.onAddStory();
    });
    await act(async () => {
      mockStoryCaptureProps.onCaptured('file:///captured.jpg', 'photo');
    });

    await act(async () => {
      mockStoryPreviewProps.onCancel();
    });

    expect(screen.queryByTestId('story-preview')).toBeNull();
    expect(postStory).not.toHaveBeenCalled();
  });
});
