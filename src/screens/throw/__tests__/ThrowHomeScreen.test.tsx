import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderWithSafeArea } from '../../../testUtils/renderWithSafeArea';
import { ThrowHomeScreen } from '../ThrowHomeScreen';
import { useAuth } from '../../../context/AuthContext';
import { useThrow } from '../../../context/ThrowContext';
import { useThrowAlerts } from '../../../context/ThrowAlertsContext';
import { useGameStats } from '../../../context/GameStatsContext';
import { useThrowColorMode } from '../../../context/ThrowColorModeContext';
import { useThrowStories } from '../../../context/ThrowStoriesContext';
import { useNotifications } from '../../../context/NotificationsContext';
import { useFriends } from '../../../context/FriendsContext';

// NotificationsPanel (rendered, via ThrowHomeScreen's own import of it, only once
// isNotificationsSelected is true — none of these tests reach that) pulls in notify.ts, which
// imports the real Supabase client at module scope; that's enough to crash under jest even
// without ever calling it, same "the bare import still runs at module-load time" reasoning as
// expo-video below.
jest.mock('../../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../context/ThrowContext', () => ({ useThrow: jest.fn() }));
jest.mock('../../../context/ThrowAlertsContext', () => ({ useThrowAlerts: jest.fn() }));
jest.mock('../../../context/GameStatsContext', () => ({ useGameStats: jest.fn() }));
jest.mock('../../../context/ThrowColorModeContext', () => ({ useThrowColorMode: jest.fn() }));
jest.mock('../../../context/ThrowStoriesContext', () => ({ useThrowStories: jest.fn() }));
jest.mock('../../../context/NotificationsContext', () => ({ useNotifications: jest.fn() }));
// Never exercised directly (isNotificationsSelected stays false in these tests, so
// NotificationsPanel never mounts), but it's imported — via NotificationsPanel — the moment
// ThrowHomeScreen's own module loads, same "the bare import still runs at module-load time"
// reasoning as expo-video below, so this has to be mocked regardless of what's rendered.
jest.mock('../../../context/FriendsContext', () => ({ useFriends: jest.fn() }));

// WeatherOverlay/RainOverlay are a purely visual screen-space effect (Animated loops/canvas,
// irrelevant to anything under test in this file) — stubbed out the same way ThrowMap is, so tests
// don't need a real ThrowWeatherContext (which itself needs a real, unmocked AuthContext/
// ThrowContext to be safe to render) or to render actual rain particles.
jest.mock('../../../components/throw/weather/WeatherOverlay', () => ({
  WeatherOverlay: () => null,
}));

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

// LetterFoldCard/PlaneSlider (the in-place received-letters panel's own visuals) are Animated-
// timer-driven and already covered by their own component-level tests — irrelevant to what this
// file tests, which is whether ThrowHomeScreen wires the in-place inbox mode correctly (mode
// toggle, BottomNav hide/chip-row show crossfade, contact-scoped letters, Throw Back plumbing).
let mockLetterFoldCardProps: any;
jest.mock('../../../components/throw/inbox/LetterFoldCard', () => ({
  LetterFoldCard: (props: any) => {
    mockLetterFoldCardProps = props;
    const { Text } = require('react-native');
    return require('react').createElement(Text, { testID: 'letter-fold-card' }, props.stage);
  },
}));

let mockPlaneSliderProps: any;
jest.mock('../../../components/throw/inbox/PlaneSlider', () => ({
  PlaneSlider: (props: any) => {
    mockPlaneSliderProps = props;
    const { Text } = require('react-native');
    return require('react').createElement(Text, { testID: 'plane-slider' }, props.contactName);
  },
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseThrow = useThrow as jest.Mock;
const mockUseThrowAlerts = useThrowAlerts as jest.Mock;
const mockUseGameStats = useGameStats as jest.Mock;
const mockUseThrowColorMode = useThrowColorMode as jest.Mock;
const mockUseThrowStories = useThrowStories as jest.Mock;
const mockUseNotifications = useNotifications as jest.Mock;
const mockUseFriends = useFriends as jest.Mock;

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
    unreadCountFor: () => 0,
    streakFor: () => 0,
    sendThrow: jest.fn(),
    uploadPhoto: jest.fn(),
    inbox: [],
    deleteThrow: jest.fn().mockResolvedValue({ error: null }),
    markRead: jest.fn().mockResolvedValue(undefined),
  });
  mockUseThrowAlerts.mockReturnValue({ createAlert, alerts: [], deleteAlert: jest.fn().mockResolvedValue({ error: null }) });
  mockUseGameStats.mockReturnValue({ statsFor: () => ({ totalPoints: 0 }) });
  mockUseThrowColorMode.mockReturnValue({ mode: 'auto', isDay: true, autoIsDay: true, setMode: jest.fn(), mapMode: 'auto', mapIsDay: true, setMapMode: jest.fn() });
  mockUseThrowStories.mockReturnValue({
    loading: false,
    storiesByUser: {},
    storyCountFor: () => 0,
    postStory: jest.fn().mockResolvedValue({ error: null }),
    markViewed: jest.fn(),
    deleteStory: jest.fn().mockResolvedValue({ error: null }),
    refresh: jest.fn(),
  });
  mockUseNotifications.mockReturnValue({ notifications: [], unreadCount: 0, acknowledge: jest.fn(), clearAll: jest.fn() });
  mockUseFriends.mockReturnValue({ friends: [], receivedRequests: [], sentRequests: [], acceptRequest: jest.fn(), declineRequest: jest.fn() });
  return createAlert;
}

async function renderScreen() {
  await renderWithSafeArea(
    <ThrowHomeScreen
      onOpenExpenses={noop}
      onOpenChats={noop}
      onOpenAddFriend={noop}
      onOpenThrowLetter={noop}
      onNotificationTarget={noop}
      onOpenSettings={noop}
    />,
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
      deleteStory: jest.fn().mockResolvedValue({ error: null }),
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

  it('passes the same contact-flick drag handlers to the inline camera as the letter itself', async () => {
    setupMocks();
    withStories(1);
    await renderScreen();

    await act(async () => {
      mockFoldingLetterProps.onContactDragStart();
      mockFoldingLetterProps.onContactDragOffset(-1);
    });
    expect(screen.getByTestId('story-capture')).toBeTruthy();
    expect(typeof mockStoryCaptureProps.onContactDragStart).toBe('function');
    expect(typeof mockStoryCaptureProps.onContactDragOffset).toBe('function');
  });

  it('flicking forward from Status inside the camera moves to the next contact and exits capture mode', async () => {
    setupMocks();
    withStories(1);
    await renderScreen();

    await act(async () => {
      mockFoldingLetterProps.onContactDragStart();
      mockFoldingLetterProps.onContactDragOffset(-1);
    });
    expect(screen.getByTestId('story-capture')).toBeTruthy();

    await act(async () => {
      mockStoryCaptureProps.onContactDragStart();
      mockStoryCaptureProps.onContactDragOffset(1);
    });

    expect(screen.queryByTestId('story-capture')).toBeNull();
    expect(screen.getByTestId('folding-letter')).toBeTruthy();
    expect(mockFoldingLetterProps.recipientName).toBe(FRIEND.name);
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
      deleteStory: jest.fn().mockResolvedValue({ error: null }),
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
    // Only Own Contact gets the falling-in entrance/long-press-to-delete affordance — a friend's
    // stories are view-only.
    expect(mockContactStoryStackProps.isOwnStories).toBe(false);
  });

  it('marks the stack as own-stories (falling-in entrance + long-press delete) only for Own Contact', async () => {
    setupMocks();
    withStoriesFor(MY_ID, 2);
    await renderScreen();

    await act(async () => {
      mockCarouselProps.onOpenStory(MY_ID);
    });

    expect(mockContactStoryStackProps.isOwnStories).toBe(true);
  });

  it('deletes a story through ThrowStoriesContext once the stack reports a delete gesture committed', async () => {
    const deleteStory = jest.fn().mockResolvedValue({ error: null });
    setupMocks();
    mockUseThrowStories.mockReturnValue({
      loading: false,
      storiesByUser: { [MY_ID]: [{ id: 's0', userId: MY_ID, mediaUrl: 'https://example.com/0.jpg', mediaType: 'photo', trimStartMs: null, trimEndMs: null, createdAt: new Date().toISOString() }] },
      storyCountFor: () => 1,
      postStory: jest.fn().mockResolvedValue({ error: null }),
      markViewed: jest.fn(),
      deleteStory,
      refresh: jest.fn(),
    });
    await renderScreen();

    await act(async () => {
      mockCarouselProps.onOpenStory(MY_ID);
    });
    await act(async () => {
      mockContactStoryStackProps.onDeleteStory('s0');
    });

    expect(deleteStory).toHaveBeenCalledWith('s0');
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

  it('stays open on its own (no auto-revert) until a different contact is selected', async () => {
    setupMocks();
    withStoriesFor(MY_ID, 1);
    await renderScreen();

    await act(async () => {
      mockCarouselProps.onOpenStory(MY_ID);
    });
    expect(screen.getByTestId('contact-story-stack')).toBeTruthy();

    // Picking a different contact (not any signal from the stack itself — there's no more
    // "exhausted" concept now that every photo just moves between avatar/letter/bin) is the only
    // way back to the compose letter.
    await act(async () => {
      mockCarouselProps.onChangeIndex(1);
    });

    expect(screen.getByTestId('folding-letter')).toBeTruthy();
    expect(screen.queryByTestId('contact-story-stack')).toBeNull();
  });

  it('passes the open contact\'s name and the avatar\'s screen position as the stack\'s flight target', async () => {
    setupMocks();
    withStoriesFor(MY_ID, 1);
    await renderScreen();

    await act(async () => {
      mockCarouselProps.onOpenStory(MY_ID);
    });

    expect(mockContactStoryStackProps.contactName).toBe('Myself');
    expect(typeof mockContactStoryStackProps.flightTargetX).toBe('number');
    expect(typeof mockContactStoryStackProps.flightTargetY).toBe('number');
  });

  it('bumps the drop signal on every re-tap of the already-open contact\'s avatar', async () => {
    setupMocks();
    withStoriesFor(MY_ID, 1);
    await renderScreen();

    await act(async () => {
      mockCarouselProps.onOpenStory(MY_ID);
    });
    const firstSignal = mockContactStoryStackProps.dropSignal;

    await act(async () => {
      mockCarouselProps.onOpenStory(MY_ID);
    });

    expect(mockContactStoryStackProps.dropSignal).toBeGreaterThan(firstSignal);
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
    // Same flight target ContactStoryStack's own flicked-away cards use — the confirmed photo
    // flies to the same place a consumed one came from.
    expect(typeof mockStoryPreviewProps.flightTargetY).toBe('number');
    // The carousel stays locked (and its chrome stays on the add-story slot) all the way through
    // capture -> preview, not just during capture — you're still mid-way through posting your own
    // story, not free to switch who you're addressing.
    expect(mockCarouselProps.disabled).toBe(true);
    expect(mockCarouselProps.isAddStorySelected).toBe(true);
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
      deleteStory: jest.fn().mockResolvedValue({ error: null }),
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

  it('discards the capture and reopens the camera, not Own Contact\'s letter, when the preview is cancelled', async () => {
    // Regression test: "X" on the preview used to fall all the way through to storyFlow === null,
    // which showed FoldingLetter for whichever contact was selected — always Own Contact, since
    // capture always sets selectedFriendId to myId — reading as an unwanted jump to "Myself"'s
    // letter instead of just backing out of the just-captured photo.
    const postStory = jest.fn().mockResolvedValue({ error: null });
    setupMocks();
    mockUseThrowStories.mockReturnValue({
      loading: false,
      storiesByUser: {},
      storyCountFor: () => 0,
      postStory,
      markViewed: jest.fn(),
      deleteStory: jest.fn().mockResolvedValue({ error: null }),
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
    expect(screen.getByTestId('story-capture')).toBeTruthy();
    expect(screen.queryByTestId('folding-letter')).toBeNull();
  });
});

describe('ThrowHomeScreen in-place received-letters panel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFoldingLetterProps = undefined;
    mockCarouselProps = undefined;
    mockLetterFoldCardProps = undefined;
    mockPlaneSliderProps = undefined;
  });

  function letter(overrides: { id: string; counterpartId: string; createdAt: string }) {
    return {
      senderId: overrides.counterpartId,
      recipientId: MY_ID,
      counterpartName: 'Priya',
      counterpartAvatarUrl: null,
      direction: 'received' as const,
      messageText: 'Hello there',
      strokes: null,
      penColor: null,
      photoUrls: [] as string[],
      senderCity: 'Pune',
      senderCountry: 'IN',
      senderLatitude: 18.5,
      senderLongitude: 73.8,
      recipientCity: 'Mumbai',
      recipientCountry: 'IN',
      recipientLatitude: 19.07,
      recipientLongitude: 72.87,
      distanceMiles: 100,
      status: 'thrown' as const,
      readAt: null,
      repliedToThrowId: null,
      ...overrides,
    };
  }

  function setupMocksWithInbox(inboxLetters: ReturnType<typeof letter>[]) {
    setupMocks();
    mockUseThrow.mockReturnValue({
      myLocation: { city: 'Mumbai', country: 'IN', latitude: 19.07, longitude: 72.87 },
      myName: 'Myself',
      myAvatarUrl: null,
      friends: [FRIEND],
      unreadCount: 0,
      unreadCountFor: () => 0,
      streakFor: () => 0,
      sendThrow: jest.fn(),
      uploadPhoto: jest.fn(),
      inbox: inboxLetters,
      deleteThrow: jest.fn().mockResolvedValue({ error: null }),
      markRead: jest.fn().mockResolvedValue(undefined),
    });
  }

  it("opens the in-place panel from FoldingLetter's own inbox icon, hiding it and BottomNav, and showing the chip row in its place", async () => {
    setupMocks();
    await renderScreen();
    expect(screen.getByTestId('folding-letter')).toBeTruthy();
    expect(typeof mockFoldingLetterProps.onOpenInbox).toBe('function');
    expect(screen.getByTestId('bottom-nav-wrap').props.pointerEvents).toBe('box-none');

    // Contacts default to "Myself" — select the actual friend first (index 1, same convention as
    // the story tests above) so the panel has someone real to scope letters to.
    await act(async () => {
      mockCarouselProps.onChangeIndex(1);
    });
    await act(async () => {
      mockFoldingLetterProps.onOpenInbox();
    });

    expect(screen.queryByTestId('folding-letter')).toBeNull();
    expect(screen.getByTestId('letter-fold-card')).toBeTruthy();
    expect(screen.getByTestId('plane-slider')).toBeTruthy();
    expect(mockPlaneSliderProps.contactName).toBe(FRIEND.name);
    expect(screen.getByTestId('bottom-nav-wrap').props.pointerEvents).toBe('none');
  });

  it("scopes the panel to only the selected contact's own letters", async () => {
    setupMocksWithInbox([
      letter({ id: 'l-other', counterpartId: 'someone-else', createdAt: new Date().toISOString() }),
      letter({ id: 'l-friend', counterpartId: FRIEND.userId, createdAt: new Date().toISOString() }),
    ]);
    await renderScreen();

    await act(async () => {
      mockCarouselProps.onChangeIndex(1);
    });
    await act(async () => {
      mockFoldingLetterProps.onOpenInbox();
    });

    expect(mockPlaneSliderProps.chips).toHaveLength(1);
    expect(mockPlaneSliderProps.chips[0].id).toBe('l-friend');
  });

  it('closes the panel via the back button, restoring FoldingLetter and BottomNav', async () => {
    setupMocks();
    await renderScreen();
    // Self defaults to no scheduled alerts, which now keeps the compose paper up instead of
    // opening an empty panel — select the actual friend first, same convention as the sibling
    // "opens the in-place panel" test above, so there's something to open and then close.
    await act(async () => {
      mockCarouselProps.onChangeIndex(1);
    });
    await act(async () => {
      mockFoldingLetterProps.onOpenInbox();
    });
    expect(screen.getByTestId('letter-fold-card')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('inbox-back-btn'));
    });

    expect(screen.queryByTestId('letter-fold-card')).toBeNull();
    expect(screen.getByTestId('folding-letter')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-wrap').props.pointerEvents).toBe('box-none');
  });

  it('hides the back button once a letter is showing — Throw Back is the only way back by then', async () => {
    setupMocksWithInbox([letter({ id: 'l1', counterpartId: FRIEND.userId, createdAt: new Date().toISOString() })]);
    await renderScreen();

    await act(async () => {
      mockCarouselProps.onChangeIndex(1);
    });
    await act(async () => {
      mockFoldingLetterProps.onOpenInbox();
    });

    expect(screen.queryByTestId('inbox-back-btn')).toBeNull();
    expect(typeof mockLetterFoldCardProps.onThrowBack).toBe('function');
  });

  it('Throw Back just closes the panel, landing on the same contact\'s normal unlocked letter', async () => {
    setupMocksWithInbox([letter({ id: 'l1', counterpartId: FRIEND.userId, createdAt: new Date().toISOString() })]);
    await renderScreen();

    await act(async () => {
      mockCarouselProps.onChangeIndex(1);
    });
    await act(async () => {
      mockFoldingLetterProps.onOpenInbox();
    });
    // activeLetter is derived synchronously from the (already-filtered) letters list — no need to
    // wait out the arrival's own flight/fold timers for onThrowBack to already be wired.
    expect(typeof mockLetterFoldCardProps.onThrowBack).toBe('function');

    await act(async () => {
      mockLetterFoldCardProps.onThrowBack();
    });

    expect(screen.queryByTestId('letter-fold-card')).toBeNull();
    expect(screen.getByTestId('folding-letter')).toBeTruthy();
    // Not locked — no lockedRecipient means FoldingLetter isn't told to fall back to "Swipe up to
    // throw back", it keeps the ordinary throw label.
    expect(mockFoldingLetterProps.throwLabel).toBe('Swipe up to throw');
  });

  it('deletes the active letter through deleteThrow when the chip row reports a delete', async () => {
    const deleteThrow = jest.fn().mockResolvedValue({ error: null });
    setupMocks();
    mockUseThrow.mockReturnValue({
      myLocation: { city: 'Mumbai', country: 'IN', latitude: 19.07, longitude: 72.87 },
      myName: 'Myself',
      myAvatarUrl: null,
      friends: [FRIEND],
      unreadCount: 0,
      unreadCountFor: () => 0,
      streakFor: () => 0,
      sendThrow: jest.fn(),
      uploadPhoto: jest.fn(),
      inbox: [letter({ id: 'l1', counterpartId: FRIEND.userId, createdAt: new Date().toISOString() })],
      deleteThrow,
      markRead: jest.fn().mockResolvedValue(undefined),
    });
    await renderScreen();

    await act(async () => {
      mockCarouselProps.onChangeIndex(1);
    });
    await act(async () => {
      mockFoldingLetterProps.onOpenInbox();
    });
    await act(async () => {
      mockPlaneSliderProps.onDelete();
    });

    expect(deleteThrow).toHaveBeenCalledWith('l1');
  });

  it("shows Myself's own self-reminder alerts as received letters, and deletes route to deleteAlert", async () => {
    const deleteAlert = jest.fn().mockResolvedValue({ error: null });
    setupMocks();
    mockUseThrowAlerts.mockReturnValue({
      createAlert: jest.fn(),
      alerts: [
        {
          id: 'alert-1',
          messageText: 'Drink water',
          strokes: null,
          penColor: '#2346C8',
          recurrence: 'everyday',
          daysOfWeek: [],
          dayOfMonth: null,
          hour: 9,
          minute: 0,
          nextTriggerAt: new Date().toISOString(),
          active: true,
        },
      ],
      deleteAlert,
    });
    // Myself is selected by default (index 0) — no onChangeIndex needed.
    await renderScreen();
    await act(async () => {
      mockFoldingLetterProps.onOpenInbox();
    });

    expect(mockLetterFoldCardProps.isEmpty).toBe(false);
    expect(mockLetterFoldCardProps.letter?.body).toBe('Drink water');
    expect(mockPlaneSliderProps.chips).toHaveLength(1);

    await act(async () => {
      mockPlaneSliderProps.onDelete();
    });

    expect(deleteAlert).toHaveBeenCalledWith('alert-1');
  });
});

describe('ThrowHomeScreen contact-flick drag (single-step cap)', () => {
  const FRIEND_A = { userId: 'friend-a', name: 'Ann', avatarUrl: null, location: { city: 'Pune', country: 'IN', latitude: 18.5, longitude: 73.8 } };
  const FRIEND_B = { userId: 'friend-b', name: 'Ben', avatarUrl: null, location: { city: 'Delhi', country: 'IN', latitude: 28.6, longitude: 77.2 } };
  const FRIEND_C = { userId: 'friend-c', name: 'Cara', avatarUrl: null, location: { city: 'Goa', country: 'IN', latitude: 15.5, longitude: 73.8 } };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFoldingLetterProps = undefined;
    mockCarouselProps = undefined;
    mockThrowMapProps = undefined;
  });

  function setupWithThreeFriends() {
    mockUseAuth.mockReturnValue({ user: { id: MY_ID } });
    mockUseThrow.mockReturnValue({
      myLocation: { city: 'Mumbai', country: 'IN', latitude: 19.07, longitude: 72.87 },
      myName: 'Myself',
      myAvatarUrl: null,
      friends: [FRIEND_A, FRIEND_B, FRIEND_C],
      unreadCount: 0,
      unreadCountFor: () => 0,
      streakFor: () => 0,
      sendThrow: jest.fn(),
      uploadPhoto: jest.fn(),
      inbox: [],
      deleteThrow: jest.fn().mockResolvedValue({ error: null }),
      markRead: jest.fn().mockResolvedValue(undefined),
    });
    mockUseThrowAlerts.mockReturnValue({ createAlert: jest.fn().mockResolvedValue({ error: null }), alerts: [], deleteAlert: jest.fn().mockResolvedValue({ error: null }) });
    mockUseGameStats.mockReturnValue({ statsFor: () => ({ totalPoints: 0 }) });
    mockUseThrowColorMode.mockReturnValue({ mode: 'auto', isDay: true, autoIsDay: true, setMode: jest.fn(), mapMode: 'auto', mapIsDay: true, setMapMode: jest.fn() });
    mockUseThrowStories.mockReturnValue({
      loading: false,
      storiesByUser: {},
      storyCountFor: () => 0,
      postStory: jest.fn().mockResolvedValue({ error: null }),
      markViewed: jest.fn(),
      deleteStory: jest.fn().mockResolvedValue({ error: null }),
      refresh: jest.fn(),
    });
  }

  it('a single flick only ever moves the selection one contact over, never more, however far the drag measured', async () => {
    setupWithThreeFriends();
    await renderScreen();
    // Myself (index 0) is selected by default.
    expect(mockFoldingLetterProps.recipientName).toBe('Myself');

    // A fast flick's raw pixel distance can translate to a steps value well past 1 (see
    // CONTACT_DRAG_SPACING) — this simulates exactly that (3 full steps' worth of drag) and
    // asserts the selection still only lands one contact over, on Ann (index 1), not Cara (index 3).
    await act(async () => {
      mockFoldingLetterProps.onContactDragStart();
      mockFoldingLetterProps.onContactDragOffset(3);
      mockFoldingLetterProps.onContactDragEnd();
    });

    expect(mockFoldingLetterProps.recipientName).toBe(FRIEND_A.name);
  });

  it('a flick the other way also only moves one contact, starting from a friend already selected', async () => {
    setupWithThreeFriends();
    await renderScreen();

    // Move to Cara (index 3) first via three separate, deliberate single-step flicks — each one
    // its own gesture, which is the only way multiple contacts over should ever be reachable.
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        mockFoldingLetterProps.onContactDragStart();
        mockFoldingLetterProps.onContactDragOffset(1);
        mockFoldingLetterProps.onContactDragEnd();
      });
    }
    expect(mockFoldingLetterProps.recipientName).toBe(FRIEND_C.name);

    // Now flick hard back the other way (steps well past -1) — should land one contact back
    // (Ben), not jump all the way past Ann/Myself.
    await act(async () => {
      mockFoldingLetterProps.onContactDragStart();
      mockFoldingLetterProps.onContactDragOffset(-3);
      mockFoldingLetterProps.onContactDragEnd();
    });

    expect(mockFoldingLetterProps.recipientName).toBe(FRIEND_B.name);
  });
});
