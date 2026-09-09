import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithSafeArea } from '../../../../testUtils/renderWithSafeArea';
import { TriviaRevealScreen } from '../TriviaRevealScreen';
import { useTriviaGame } from '../../../../context/TriviaGameContext';
import type { TriviaAnswer, TriviaPlayer, TriviaQuestion } from '../../../../types/trivia';

jest.mock('../../../../context/TriviaGameContext', () => ({
  useTriviaGame: jest.fn(),
}));

const mockUseTriviaGame = useTriviaGame as jest.Mock;

const revealedQuestion: TriviaQuestion = {
  id: 'q3',
  gameId: 'g1',
  questionIndex: 2,
  questionText: 'What is the chemical symbol for gold?',
  category: 'Science',
  difficulty: 'medium',
  answers: [
    { id: 'a', text: 'Ag' },
    { id: 'b', text: 'Au' },
  ],
  status: 'revealed',
  startsAt: new Date(Date.now() - 20000).toISOString(),
  endsAt: new Date(Date.now() - 1000).toISOString(),
  revealEndsAt: new Date(Date.now() + 8000).toISOString(),
};

const players: TriviaPlayer[] = [
  { id: 'p1', gameId: 'g1', userId: 'u1', name: 'You', score: 260, correctAnswers: 2, incorrectAnswers: 0, unanswered: 0, fastestAnswers: 1, active: true, lastSeenAt: new Date().toISOString() },
  { id: 'p2', gameId: 'g1', userId: 'u2', name: 'Priya', score: 340, correctAnswers: 3, incorrectAnswers: 0, unanswered: 0, fastestAnswers: 2, active: true, lastSeenAt: new Date().toISOString() },
  { id: 'p3', gameId: 'g1', userId: 'u3', name: 'Sam', score: 180, correctAnswers: 1, incorrectAnswers: 1, unanswered: 1, fastestAnswers: 0, active: true, lastSeenAt: new Date().toISOString() },
];

const answers: TriviaAnswer[] = [
  { id: 'ans1', gameId: 'g1', questionId: 'q3', playerId: 'p1', answerId: 'b', isCorrect: true, responseTimeMs: 3200, speedBonus: 34, points: 134 },
  { id: 'ans2', gameId: 'g1', questionId: 'q3', playerId: 'p2', answerId: 'b', isCorrect: true, responseTimeMs: 1800, speedBonus: 45, points: 145 },
  { id: 'ans3', gameId: 'g1', questionId: 'q3', playerId: 'p3', answerId: 'a', isCorrect: false, responseTimeMs: 5000, speedBonus: 0, points: 0 },
];

function baseContext(overrides: Partial<ReturnType<typeof useTriviaGame>> = {}) {
  return {
    currentQuestion: revealedQuestion,
    correctAnswerId: 'b',
    answers,
    players,
    myPlayerId: 'p1',
    ...overrides,
  };
}

beforeEach(() => {
  mockUseTriviaGame.mockReset();
});

describe('TriviaRevealScreen', () => {
  it('shows the correct answer text', async () => {
    mockUseTriviaGame.mockReturnValue(baseContext());
    await renderWithSafeArea(<TriviaRevealScreen />);

    expect(screen.getByText('Au')).toBeTruthy();
  });

  it('ranks the leaderboard by score, highest first', async () => {
    mockUseTriviaGame.mockReturnValue(baseContext());
    await renderWithSafeArea(<TriviaRevealScreen />);

    const names = screen.getAllByText(/^(Priya|You|Sam)/, { exact: false }).map((n) => (Array.isArray(n.props.children) ? n.props.children.join('') : n.props.children));
    expect(names).toEqual(['Priya', 'You (you)', 'Sam']);
  });

  it("labels each player's result and points gained correctly", async () => {
    mockUseTriviaGame.mockReturnValue(baseContext());
    await renderWithSafeArea(<TriviaRevealScreen />);

    expect(screen.getAllByText('✓ Correct')).toHaveLength(2);
    expect(screen.getByText('✕ Incorrect')).toBeTruthy();
    expect(screen.getByText('+145')).toBeTruthy();
    expect(screen.getByText('+134')).toBeTruthy();
  });

  it('shows "No answer" for a player who never submitted', async () => {
    mockUseTriviaGame.mockReturnValue(
      baseContext({
        answers: answers.filter((a) => a.playerId !== 'p3'),
      }),
    );
    await renderWithSafeArea(<TriviaRevealScreen />);

    expect(screen.getByText('No answer')).toBeTruthy();
  });

  it('excludes players who have left the game', async () => {
    mockUseTriviaGame.mockReturnValue(
      baseContext({
        players: [...players, { id: 'p4', gameId: 'g1', userId: 'u4', name: 'Left Player', score: 0, correctAnswers: 0, incorrectAnswers: 0, unanswered: 0, fastestAnswers: 0, active: false, lastSeenAt: new Date().toISOString() }],
      }),
    );
    await renderWithSafeArea(<TriviaRevealScreen />);

    expect(screen.queryByText('Left Player')).toBeNull();
  });
});
