import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithSafeArea } from '../../../../testUtils/renderWithSafeArea';
import { TriviaFinalResultsScreen } from '../TriviaFinalResultsScreen';
import { useTriviaGame } from '../../../../context/TriviaGameContext';
import type { TriviaPlayer } from '../../../../types/trivia';

jest.mock('../../../../context/TriviaGameContext', () => ({
  useTriviaGame: jest.fn(),
}));

const mockUseTriviaGame = useTriviaGame as jest.Mock;

const players: TriviaPlayer[] = [
  { id: 'p1', gameId: 'g1', userId: 'u1', name: 'You', score: 260, correctAnswers: 2, incorrectAnswers: 1, unanswered: 1, fastestAnswers: 1, active: true, lastSeenAt: new Date().toISOString() },
  { id: 'p2', gameId: 'g1', userId: 'u2', name: 'Priya', score: 340, correctAnswers: 3, incorrectAnswers: 0, unanswered: 1, fastestAnswers: 2, active: true, lastSeenAt: new Date().toISOString() },
];

beforeEach(() => {
  mockUseTriviaGame.mockReset();
});

describe('TriviaFinalResultsScreen', () => {
  it('crowns the highest scorer as winner', async () => {
    mockUseTriviaGame.mockReturnValue({ players, myPlayerId: 'p1', leaveGame: jest.fn() });
    await renderWithSafeArea(<TriviaFinalResultsScreen onHome={() => {}} />);

    expect(screen.getAllByText('Priya').length).toBeGreaterThanOrEqual(2); // winner banner + leaderboard row
    expect(screen.getByText('340 POINTS')).toBeTruthy();
  });

  it("computes my own accuracy from correct/incorrect/unanswered", async () => {
    mockUseTriviaGame.mockReturnValue({ players, myPlayerId: 'p1', leaveGame: jest.fn() });
    await renderWithSafeArea(<TriviaFinalResultsScreen onHome={() => {}} />);

    // 2 correct out of 4 total answered questions (2 + 1 + 1) = 50%.
    expect(screen.getByText('50%')).toBeTruthy();
  });

  it('calls leaveGame and onHome when "Back to Games" is pressed', async () => {
    const leaveGame = jest.fn();
    const onHome = jest.fn();
    mockUseTriviaGame.mockReturnValue({ players, myPlayerId: 'p1', leaveGame });
    await renderWithSafeArea(<TriviaFinalResultsScreen onHome={onHome} />);

    fireEvent.press(screen.getByText('Back to Games'));
    expect(leaveGame).toHaveBeenCalled();
    expect(onHome).toHaveBeenCalled();
  });
});
