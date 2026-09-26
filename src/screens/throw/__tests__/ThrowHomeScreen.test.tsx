import React from 'react';
import { act } from '@testing-library/react-native';
import { renderWithSafeArea } from '../../../testUtils/renderWithSafeArea';
import { ThrowHomeScreen } from '../ThrowHomeScreen';
import { useAuth } from '../../../context/AuthContext';
import { useThrow } from '../../../context/ThrowContext';
import { useThrowAlerts } from '../../../context/ThrowAlertsContext';
import { useGameStats } from '../../../context/GameStatsContext';

jest.mock('../../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../context/ThrowContext', () => ({ useThrow: jest.fn() }));
jest.mock('../../../context/ThrowAlertsContext', () => ({ useThrowAlerts: jest.fn() }));
jest.mock('../../../context/GameStatsContext', () => ({ useGameStats: jest.fn() }));

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

const mockUseAuth = useAuth as jest.Mock;
const mockUseThrow = useThrow as jest.Mock;
const mockUseThrowAlerts = useThrowAlerts as jest.Mock;
const mockUseGameStats = useGameStats as jest.Mock;

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
  return createAlert;
}

async function renderScreen() {
  await renderWithSafeArea(
    <ThrowHomeScreen onHome={noop} onOpenExpenses={noop} onOpenChats={noop} onOpenAddFriend={noop} onOpenInbox={noop} onOpenSettings={noop} />,
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

  it('locks the carousel and map pins once the self-reminder has any content', async () => {
    setupMocks();
    await renderScreen();
    expect(mockCarouselProps.disabled).toBe(false);

    await act(async () => {
      mockFoldingLetterProps.onHasContentChange(true);
    });

    expect(mockCarouselProps.disabled).toBe(true);
    const friendPin = mockThrowMapProps.pins.find((p: any) => p.id === FRIEND.userId);
    expect(friendPin.onPress).toBeUndefined();
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
      mockFoldingLetterProps.onHasContentChange(true);
    });
    expect(mockCarouselProps.disabled).toBe(true);

    await act(async () => {
      await mockFoldingLetterProps.onThrow({ messageText: 'Drink water', strokes: null, penColor: '#4A90D9', photoUris: [] });
    });

    expect(createAlert).toHaveBeenCalled();
    expect(mockCarouselProps.disabled).toBe(false);
  });
});
