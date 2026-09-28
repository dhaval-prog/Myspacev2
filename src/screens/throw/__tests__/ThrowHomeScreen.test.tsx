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

// WeatherOverlay/RainOverlay are a purely visual screen-space effect (Animated loops/canvas,
// irrelevant to anything under test in this file) — stubbed out the same way ThrowMap is, so tests
// don't need a real ThrowWeatherContext (which itself needs a real, unmocked AuthContext/
// ThrowContext to be safe to render) or to render actual rain particles.
jest.mock('../../../components/throw/weather/WeatherOverlay', () => ({
  WeatherOverlay: () => null,
}));

// expo-video has no jest/native-module fallback the way most other Expo packages here do (it
// throws at import time in this test environment) — only MyStatusPanel/ContactStoryStack touch
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

// The live camera/capture/review/own-status flow is entirely MyStatusPanel's own concern now
// (see its own dedicated test file) — this screen only needs to prove it wires the right props
// through and mounts/hides it at the right times, same convention as ContactStoryStack above.
let mockMyStatusPanelProps: any;
jest.mock('../../../components/throw/MyStatusPanel', () => ({
  MyStatusPanel: (props: any) => {
    mockMyStatusPanelProps = props;
    const { Text } = require('react-native');
    return require('react').createElement(Text, { testID: 'my-status-panel' }, 'status');
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
    deleteStory: jest.fn().mockResolvedValue({ error: null }),
    refresh: jest.fn(),
  });
  return createAlert;
}

async function renderScreen() {
  await renderWithSafeArea(
    <ThrowHomeScreen onOpenExpenses={noop} onOpenChats={noop} onOpenAddFriend={noop} onOpenInbox={noop} onOpenSettings={noop} />,
  );
}

// core.springTo commits synchronously (see useCarouselPos's own doc comment) but also kicks off a
// real requestAnimationFrame loop that needs to actually finish before the next act() block, same
// reasoning RecipientCarousel's own test file needed this for.
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 700));
  });
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

describe('ThrowHomeScreen tap-to-view story (a real contact, inline in the card)', () => {
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

  it("opens a friend's stories inline, without moving the carousel's own selection", async () => {
    setupMocks();
    withStoriesFor(FRIEND.userId, 3);
    await renderScreen();

    await act(async () => {
      mockCarouselProps.core.springTo(1);
    });
    await settle();
    await act(async () => {
      mockCarouselProps.onOpenStory(FRIEND.userId);
    });

    expect(screen.queryByTestId('folding-letter')).toBeNull();
    expect(screen.getByTestId('contact-story-stack')).toBeTruthy();
    expect(mockContactStoryStackProps.stories).toHaveLength(3);
    expect(mockContactStoryStackProps.isOwnStories).toBe(false);
  });

  it('deletes a story through ThrowStoriesContext once the stack reports a delete gesture committed', async () => {
    const deleteStory = jest.fn().mockResolvedValue({ error: null });
    setupMocks();
    mockUseThrowStories.mockReturnValue({
      loading: false,
      storiesByUser: { [FRIEND.userId]: [{ id: 's0', userId: FRIEND.userId, mediaUrl: 'https://example.com/0.jpg', mediaType: 'photo', trimStartMs: null, trimEndMs: null, createdAt: new Date().toISOString() }] },
      storyCountFor: () => 1,
      postStory: jest.fn().mockResolvedValue({ error: null }),
      markViewed: jest.fn(),
      deleteStory,
      refresh: jest.fn(),
    });
    await renderScreen();

    await act(async () => {
      mockCarouselProps.core.springTo(1);
    });
    await settle();
    await act(async () => {
      mockCarouselProps.onOpenStory(FRIEND.userId);
    });
    await act(async () => {
      mockContactStoryStackProps.onDeleteStory('s0');
    });

    expect(deleteStory).toHaveBeenCalledWith('s0');
  });

  it('does nothing for a contact with no active stories', async () => {
    setupMocks();
    withStoriesFor(FRIEND.userId, 0);
    await renderScreen();

    await act(async () => {
      mockCarouselProps.core.springTo(1);
    });
    await settle();
    await act(async () => {
      mockCarouselProps.onOpenStory(FRIEND.userId);
    });

    expect(screen.getByTestId('folding-letter')).toBeTruthy();
    expect(screen.queryByTestId('contact-story-stack')).toBeNull();
  });

  it('stays open on its own (no auto-revert) until a different contact is selected', async () => {
    setupMocks();
    withStoriesFor(FRIEND.userId, 1);
    await renderScreen();

    await act(async () => {
      mockCarouselProps.core.springTo(1);
    });
    await settle();
    await act(async () => {
      mockCarouselProps.onOpenStory(FRIEND.userId);
    });
    expect(screen.getByTestId('contact-story-stack')).toBeTruthy();

    // Picking a different contact (not any signal from the stack itself) is the only way back to
    // the compose letter.
    await act(async () => {
      mockCarouselProps.core.springTo(0);
    });
    await settle();

    expect(screen.getByTestId('folding-letter')).toBeTruthy();
    expect(screen.queryByTestId('contact-story-stack')).toBeNull();
  });

  it("passes the open contact's name and the avatar's screen position as the stack's flight target", async () => {
    setupMocks();
    withStoriesFor(FRIEND.userId, 1);
    await renderScreen();

    await act(async () => {
      mockCarouselProps.core.springTo(1);
    });
    await settle();
    await act(async () => {
      mockCarouselProps.onOpenStory(FRIEND.userId);
    });

    expect(mockContactStoryStackProps.contactName).toBe(FRIEND.name);
    expect(typeof mockContactStoryStackProps.flightTargetX).toBe('number');
    expect(typeof mockContactStoryStackProps.flightTargetY).toBe('number');
  });

  it('bumps the drop signal on every re-tap of the already-open contact\'s avatar', async () => {
    setupMocks();
    withStoriesFor(FRIEND.userId, 1);
    await renderScreen();

    await act(async () => {
      mockCarouselProps.core.springTo(1);
    });
    await settle();
    await act(async () => {
      mockCarouselProps.onOpenStory(FRIEND.userId);
    });
    const firstSignal = mockContactStoryStackProps.dropSignal;

    await act(async () => {
      mockCarouselProps.onOpenStory(FRIEND.userId);
    });

    expect(mockContactStoryStackProps.dropSignal).toBeGreaterThan(firstSignal);
  });

  it('never treats "Myself" (the self-reminder slot) as a story to open, via RecipientCarousel\'s own selfUserId exclusion', async () => {
    setupMocks();
    withStoriesFor(MY_ID, 4);
    await renderScreen();

    expect(mockCarouselProps.selfUserId).toBe(MY_ID);
  });
});

describe('ThrowHomeScreen "You" status camera', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCarouselProps = undefined;
    mockMyStatusPanelProps = undefined;
  });

  it('is always mounted, reading its own stories from ThrowStoriesContext keyed by my own id', async () => {
    setupMocks();
    mockUseThrowStories.mockReturnValue({
      loading: false,
      storiesByUser: { [MY_ID]: [{ id: 's0', userId: MY_ID, mediaUrl: 'https://example.com/0.jpg', mediaType: 'photo', trimStartMs: null, trimEndMs: null, createdAt: new Date().toISOString() }] },
      storyCountFor: () => 1,
      postStory: jest.fn().mockResolvedValue({ error: null }),
      markViewed: jest.fn(),
      deleteStory: jest.fn().mockResolvedValue({ error: null }),
      refresh: jest.fn(),
    });
    await renderScreen();

    expect(screen.getByTestId('my-status-panel')).toBeTruthy();
    expect(mockMyStatusPanelProps.stories).toHaveLength(1);
    expect(typeof mockMyStatusPanelProps.postStory).toBe('function');
  });

  it('hides the compose letter while "You" (rail index -1) is selected', async () => {
    setupMocks();
    await renderScreen();
    expect(screen.getByTestId('folding-letter')).toBeTruthy();

    await act(async () => {
      mockCarouselProps.core.springTo(-1);
    });
    await settle();

    expect(screen.queryByTestId('folding-letter')).toBeNull();
    expect(screen.getByTestId('my-status-panel')).toBeTruthy();
  });

  it('bumps a dedicated drop signal on every re-tap of the already-selected "You" avatar, separate from a real contact\'s', async () => {
    setupMocks();
    await renderScreen();

    await act(async () => {
      mockCarouselProps.core.springTo(-1);
    });
    await settle();
    const before = mockMyStatusPanelProps.dropSignal;

    await act(async () => {
      mockCarouselProps.onOpenYouStatus();
    });

    expect(mockMyStatusPanelProps.dropSignal).toBeGreaterThan(before);
  });

  it('springs back to the last real contact when MyStatusPanel\'s own close (✕) fires', async () => {
    setupMocks();
    await renderScreen();

    await act(async () => {
      mockCarouselProps.core.springTo(1);
    });
    await settle();
    await act(async () => {
      mockCarouselProps.core.springTo(-1);
    });
    await settle();
    expect(screen.queryByTestId('folding-letter')).toBeNull();

    await act(async () => {
      mockMyStatusPanelProps.onClose();
    });
    await settle();

    expect(screen.getByTestId('folding-letter')).toBeTruthy();
    expect(mockFoldingLetterProps.recipientName).toBe(FRIEND.name);
  });
});
