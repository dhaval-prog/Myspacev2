import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithSafeArea } from '../../../../testUtils/renderWithSafeArea';
import { TriviaQuestionScreen, formatClock } from '../TriviaQuestionScreen';
import { useTriviaGame } from '../../../../context/TriviaGameContext';
import type { TriviaAnswer, TriviaGame, TriviaQuestion } from '../../../../types/trivia';

jest.mock('../../../../context/TriviaGameContext', () => ({
  useTriviaGame: jest.fn(),
}));

const mockUseTriviaGame = useTriviaGame as jest.Mock;

describe('formatClock', () => {
  it('pads minutes and seconds to two digits', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(5)).toBe('00:05');
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(3599)).toBe('59:59');
  });
});

const baseGame: TriviaGame = {
  id: 'g1',
  roomCode: 'ABC123',
  hostId: 'u-host',
  status: 'active',
  category: 'Science',
  difficulty: 'mixed',
  questionCount: 10,
  timePerQuestion: 20,
  currentQuestionIndex: 2,
  startedAt: new Date().toISOString(),
  completedAt: null,
};

const baseQuestion: TriviaQuestion = {
  id: 'q3',
  gameId: 'g1',
  questionIndex: 2,
  questionText: 'What is the chemical symbol for gold?',
  category: 'Science',
  difficulty: 'medium',
  answers: [
    { id: 'a', text: 'Ag' },
    { id: 'b', text: 'Au' },
    { id: 'c', text: 'Gd' },
    { id: 'd', text: 'Go' },
  ],
  status: 'active',
  startsAt: new Date(Date.now() - 5000).toISOString(),
  endsAt: new Date(Date.now() + 15000).toISOString(),
  revealEndsAt: null,
};

function baseContext(overrides: Partial<ReturnType<typeof useTriviaGame>> = {}) {
  return {
    game: baseGame,
    currentQuestion: baseQuestion,
    myPlayerId: 'p1',
    players: [{ id: 'p1', gameId: 'g1', userId: 'u1', name: 'You', score: 260, correctAnswers: 2, incorrectAnswers: 0, unanswered: 0, fastestAnswers: 1, active: true, lastSeenAt: new Date().toISOString() }],
    myAnswer: null,
    submitAnswer: jest.fn(async () => ({ error: null })),
    submittingAnswer: false,
    answerError: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockUseTriviaGame.mockReset();
});

describe('TriviaQuestionScreen', () => {
  it('renders the question, category, options, and current score', async () => {
    mockUseTriviaGame.mockReturnValue(baseContext());
    await renderWithSafeArea(<TriviaQuestionScreen />);

    expect(screen.getByText('What is the chemical symbol for gold?')).toBeTruthy();
    expect(screen.getByText('SCIENCE')).toBeTruthy();
    expect(screen.getByText('Question 3 / 10')).toBeTruthy();
    expect(screen.getByText('260 points')).toBeTruthy();
    expect(screen.getByText('Au')).toBeTruthy();
  });

  it('submits the tapped answer and is not yet locked before the response resolves', async () => {
    const submitAnswer = jest.fn(async () => ({ error: null }));
    mockUseTriviaGame.mockReturnValue(baseContext({ submitAnswer }));
    await renderWithSafeArea(<TriviaQuestionScreen />);

    fireEvent.press(screen.getByLabelText('B. Au'));
    expect(submitAnswer).toHaveBeenCalledWith('b');
  });

  it('locks every option and shows the waiting note once myAnswer is set', async () => {
    const myAnswer: TriviaAnswer = { id: 'ans1', gameId: 'g1', questionId: 'q3', playerId: 'p1', answerId: 'b', isCorrect: true, responseTimeMs: 2000, speedBonus: 30, points: 130 };
    mockUseTriviaGame.mockReturnValue(baseContext({ myAnswer }));
    await renderWithSafeArea(<TriviaQuestionScreen />);

    expect(screen.getByText('Answer locked — waiting for the others…')).toBeTruthy();
    expect(screen.getByLabelText('B. Au').props.accessibilityState).toMatchObject({ disabled: true, selected: true });
    expect(screen.getByLabelText('A. Ag').props.accessibilityState).toMatchObject({ disabled: true, selected: false });

    const submitAnswer = mockUseTriviaGame.mock.results[0].value.submitAnswer;
    fireEvent.press(screen.getByLabelText('A. Ag'));
    expect(submitAnswer).not.toHaveBeenCalled();
  });

  it('shows the answer error message when one is present', async () => {
    mockUseTriviaGame.mockReturnValue(baseContext({ answerError: 'Something went wrong.' }));
    await renderWithSafeArea(<TriviaQuestionScreen />);

    expect(screen.getByText('Something went wrong.')).toBeTruthy();
  });

  it('renders nothing before the game/question have loaded', async () => {
    mockUseTriviaGame.mockReturnValue(baseContext({ game: null, currentQuestion: null }));
    await renderWithSafeArea(<TriviaQuestionScreen />);

    expect(screen.queryByText('SCIENCE')).toBeNull();
  });
});
