import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithSafeArea } from '../../../../testUtils/renderWithSafeArea';
import { TriviaLobbyScreen } from '../TriviaLobbyScreen';
import { useTriviaGame } from '../../../../context/TriviaGameContext';
import { useAuth } from '../../../../context/AuthContext';
import type { TriviaGame, TriviaPlayer } from '../../../../types/trivia';

jest.mock('../../../../context/TriviaGameContext', () => ({
  useTriviaGame: jest.fn(),
}));
jest.mock('../../../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockUseTriviaGame = useTriviaGame as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const game: TriviaGame = {
  id: 'g1',
  roomCode: 'ABC123',
  hostId: 'u-host',
  status: 'waiting',
  category: 'Random',
  difficulty: 'mixed',
  questionCount: 10,
  timePerQuestion: 20,
  currentQuestionIndex: 0,
  startedAt: null,
  completedAt: null,
};

function player(overrides: Partial<TriviaPlayer>): TriviaPlayer {
  return {
    id: 'p1',
    gameId: 'g1',
    userId: 'u1',
    name: 'Someone',
    score: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    unanswered: 0,
    fastestAnswers: 0,
    active: true,
    lastSeenAt: new Date().toISOString(),
    ...overrides,
  };
}

function baseContext(overrides: Partial<ReturnType<typeof useTriviaGame>> = {}) {
  return {
    game,
    players: [player({ id: 'p-host', userId: 'u-host', name: 'Priya' }), player({ id: 'p-me', userId: 'u-me', name: 'You' })],
    myPlayerId: 'p-me',
    loading: false,
    createGame: jest.fn(),
    joinGame: jest.fn(),
    leaveGame: jest.fn(),
    startGame: jest.fn(async () => ({ error: null })),
    hostChangedTo: null,
    dismissHostChanged: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockUseTriviaGame.mockReset();
  mockUseAuth.mockReset();
});

describe('TriviaLobbyScreen — ready room', () => {
  it('shows the host a disabled Start Game button with fewer than 2 active players', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u-host' } });
    mockUseTriviaGame.mockReturnValue(baseContext({ players: [player({ id: 'p-host', userId: 'u-host', name: 'Priya' })] }));
    await renderWithSafeArea(<TriviaLobbyScreen onHome={() => {}} onOpenExpenses={() => {}} onOpenSplit={() => {}} />);

    expect(screen.getByText('Need 2+ players')).toBeTruthy();
  });

  it('lets the host start the game once there are 2+ active players', async () => {
    const startGame = jest.fn(async () => ({ error: null }));
    mockUseAuth.mockReturnValue({ user: { id: 'u-host' } });
    mockUseTriviaGame.mockReturnValue(baseContext({ startGame }));
    await renderWithSafeArea(<TriviaLobbyScreen onHome={() => {}} onOpenExpenses={() => {}} onOpenSplit={() => {}} />);

    fireEvent.press(screen.getByText('Start Game'));
    expect(startGame).toHaveBeenCalled();
  });

  it('shows a non-host a waiting hint naming the host', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u-me' } });
    mockUseTriviaGame.mockReturnValue(baseContext());
    await renderWithSafeArea(<TriviaLobbyScreen onHome={() => {}} onOpenExpenses={() => {}} onOpenSplit={() => {}} />);

    expect(screen.getByText('Waiting for Priya to start…')).toBeTruthy();
    expect(screen.queryByText('Start Game')).toBeNull();
  });

  it('badges a stale other player as DISCONNECTED but never badges myself', async () => {
    const staleTime = new Date(Date.now() - 30000).toISOString();
    mockUseAuth.mockReturnValue({ user: { id: 'u-me' } });
    mockUseTriviaGame.mockReturnValue(
      baseContext({
        players: [
          player({ id: 'p-host', userId: 'u-host', name: 'Priya', lastSeenAt: staleTime }),
          player({ id: 'p-me', userId: 'u-me', name: 'You', lastSeenAt: staleTime }),
        ],
      }),
    );
    await renderWithSafeArea(<TriviaLobbyScreen onHome={() => {}} onOpenExpenses={() => {}} onOpenSplit={() => {}} />);

    expect(screen.getAllByText('DISCONNECTED')).toHaveLength(1);
  });

  it('does not badge a recently active player', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u-me' } });
    mockUseTriviaGame.mockReturnValue(baseContext());
    await renderWithSafeArea(<TriviaLobbyScreen onHome={() => {}} onOpenExpenses={() => {}} onOpenSplit={() => {}} />);

    expect(screen.queryByText('DISCONNECTED')).toBeNull();
  });

  it('shows the host-changed banner and dismisses it on tap', async () => {
    const dismissHostChanged = jest.fn();
    mockUseAuth.mockReturnValue({ user: { id: 'u-me' } });
    mockUseTriviaGame.mockReturnValue(baseContext({ hostChangedTo: 'Priya', dismissHostChanged }));
    await renderWithSafeArea(<TriviaLobbyScreen onHome={() => {}} onOpenExpenses={() => {}} onOpenSplit={() => {}} />);

    const banner = screen.getByText('👑 Priya is now the host');
    expect(banner).toBeTruthy();
    fireEvent.press(banner);
    expect(dismissHostChanged).toHaveBeenCalled();
  });

  it('renders no banner when there is no pending host change', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u-me' } });
    mockUseTriviaGame.mockReturnValue(baseContext());
    await renderWithSafeArea(<TriviaLobbyScreen onHome={() => {}} onOpenExpenses={() => {}} onOpenSplit={() => {}} />);

    expect(screen.queryByText(/is now the host/)).toBeNull();
  });
});
