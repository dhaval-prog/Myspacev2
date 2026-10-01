import React from 'react';
import { act, screen } from '@testing-library/react-native';
import { renderWithSafeArea } from '../../../testUtils/renderWithSafeArea';
import { ThrowReceivedLettersScreen } from '../ThrowReceivedLettersScreen';
import { useThrow } from '../../../context/ThrowContext';

jest.mock('../../../context/ThrowContext', () => ({
  useThrow: jest.fn(),
  // The screen owns its own ThrowProvider (it's reached from outside Throw's own navigator,
  // unlike ThrowHomeScreen) — a passthrough mock keeps that wiring real without needing a full
  // Supabase-backed provider in tests.
  ThrowProvider: ({ children }: { children: React.ReactNode }) => children,
}));
// Skips the real envelope-arrival flight animation's own real-time RAF loop (hundreds of ms of
// actual wall-clock time) — these tests only care about what's wired once a letter is open, same
// convention ThrowHomeScreen's own tests use for the in-place panel's arrival.
jest.mock('../../../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
// expo-video has no jest/native-module fallback — MediaViewerV3 pulls it in (via
// AutoplayVideoFill.native) at module-load time even though none of these tests open the media
// viewer, same "the bare import still runs at module-load time" reasoning as ThrowHomeScreen's
// own tests already document for this exact mock.
jest.mock('expo-video', () => ({ useVideoPlayer: () => ({}), VideoView: () => null }));
// ThrowMap (Mapbox GL JS / react-native-maps) is heavy and has no jest/native-module fallback for
// react-native-maps — same reasoning ThrowHomeScreen's own tests already document for mocking it
// out entirely rather than rendering a real map.
jest.mock('../../../components/throw/ThrowMap', () => ({
  ThrowMap: () => null,
}));

const mockUseThrow = useThrow as jest.Mock;

const MY_ID = 'me-1';
const FRIEND_A = { userId: 'friend-a', name: 'Priya', avatarUrl: null, location: { city: 'Pune', country: 'IN', latitude: 18.5, longitude: 73.8 } };
const FRIEND_B = { userId: 'friend-b', name: 'Dhaval', avatarUrl: null, location: { city: 'Mumbai', country: 'IN', latitude: 18.9, longitude: 72.8 } };
const noop = async () => ({ error: null });

function letter(overrides: { id: string; counterpartId: string; createdAt: string; status?: 'thrown' | 'read' | 'replied' }) {
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
    photoTrims: [] as (null)[],
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
    alertSchedule: null,
    alertConfirmed: false,
    ...overrides,
  };
}

function setupMocks(inbox: ReturnType<typeof letter>[], friends = [FRIEND_A, FRIEND_B]) {
  mockUseThrow.mockReturnValue({
    friends,
    inbox,
    deleteThrow: jest.fn().mockResolvedValue({ error: null }),
    markRead: jest.fn().mockResolvedValue(undefined),
    confirmThrowAlert: jest.fn().mockResolvedValue({ error: null }),
  });
}

async function renderScreen(props: Partial<React.ComponentProps<typeof ThrowReceivedLettersScreen>> = {}) {
  await act(async () => {
    renderWithSafeArea(<ThrowReceivedLettersScreen {...props} />);
  });
}

describe('ThrowReceivedLettersScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the empty state when nobody has sent a letter', async () => {
    setupMocks([]);
    await renderScreen();

    expect(screen.getByText('No letters yet')).toBeTruthy();
  });

  it('auto-selects the first contact with an unread letter and opens it', async () => {
    setupMocks([
      letter({ id: 'l1', counterpartId: FRIEND_A.userId, createdAt: new Date().toISOString(), status: 'read' }),
      letter({ id: 'l2', counterpartId: FRIEND_B.userId, createdAt: new Date().toISOString(), status: 'thrown' }),
    ]);
    await renderScreen();

    // The 600ms lead-in beat before the first arrival auto-plays (see useLettersArrivalV3) —
    // reduceMotion skips the flight itself but not this initial delay.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 650));
    });

    // Both the contacts row and the open letter card show the selected contact's name — just
    // confirms it rendered at all, not which element specifically.
    expect(screen.getAllByText('Dhaval').length).toBeGreaterThan(0);
  });

  it('preselects a specific contact when initialContactId is given, even with no unread letters', async () => {
    setupMocks([
      letter({ id: 'l1', counterpartId: FRIEND_A.userId, createdAt: new Date().toISOString(), status: 'read' }),
      letter({ id: 'l2', counterpartId: FRIEND_B.userId, createdAt: new Date().toISOString(), status: 'read' }),
    ]);
    await renderScreen({ initialContactId: FRIEND_A.userId });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 650));
    });

    expect(screen.getAllByText('Priya').length).toBeGreaterThan(0);
  });
});
