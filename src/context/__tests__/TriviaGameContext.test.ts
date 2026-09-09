// TriviaGameContext.tsx pulls in the real Supabase client and AuthContext (which
// itself calls expo-auth-session's makeRedirectUri() at module load time) —
// neither has anything to do with the pure row-mapping functions under test
// here, and both throw under Jest's non-Expo-runtime environment. Stub them
// out so importing the module for its pure helpers doesn't require a real
// native/Expo environment.
jest.mock('../../lib/supabase', () => ({ supabase: {}, isSupabaseConfigured: false }));
jest.mock('../AuthContext', () => ({ useAuth: () => ({ user: null }) }));

import { toAnswer, toGame, toPlayer, toQuestion } from '../TriviaGameContext';

describe('toGame', () => {
  it('maps every snake_case DB column to its camelCase field', () => {
    expect(
      toGame({
        id: 'g1',
        room_code: 'ABC123',
        host_id: 'u1',
        status: 'active',
        category: 'Science',
        difficulty: 'mixed',
        question_count: 10,
        time_per_question: 20,
        current_question_index: 2,
        started_at: '2026-01-01T00:00:00.000Z',
        completed_at: null,
      }),
    ).toEqual({
      id: 'g1',
      roomCode: 'ABC123',
      hostId: 'u1',
      status: 'active',
      category: 'Science',
      difficulty: 'mixed',
      questionCount: 10,
      timePerQuestion: 20,
      currentQuestionIndex: 2,
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: null,
    });
  });
});

describe('toPlayer', () => {
  it('derives `active` from a null left_at', () => {
    const player = toPlayer({
      id: 'p1',
      game_id: 'g1',
      user_id: 'u1',
      name: 'Priya',
      score: 340,
      correct_answers: 3,
      incorrect_answers: 0,
      unanswered: 0,
      fastest_answers: 2,
      left_at: null,
      last_seen_at: '2026-01-01T00:00:05.000Z',
    });
    expect(player.active).toBe(true);
    expect(player.lastSeenAt).toBe('2026-01-01T00:00:05.000Z');
  });

  it('derives `active: false` once left_at is set', () => {
    const player = toPlayer({
      id: 'p1',
      game_id: 'g1',
      user_id: 'u1',
      name: 'Priya',
      score: 0,
      correct_answers: 0,
      incorrect_answers: 0,
      unanswered: 0,
      fastest_answers: 0,
      left_at: '2026-01-01T00:01:00.000Z',
      last_seen_at: '2026-01-01T00:00:05.000Z',
    });
    expect(player.active).toBe(false);
  });
});

describe('toQuestion', () => {
  it('maps answers through untouched and preserves null timing fields', () => {
    const question = toQuestion({
      id: 'q1',
      game_id: 'g1',
      question_index: 0,
      question_text: 'What is the chemical symbol for gold?',
      category: 'Science',
      difficulty: 'medium',
      answers: [
        { id: 'a', text: 'Ag' },
        { id: 'b', text: 'Au' },
      ],
      status: 'pending',
      starts_at: null,
      ends_at: null,
      reveal_ends_at: null,
    });
    expect(question.answers).toEqual([
      { id: 'a', text: 'Ag' },
      { id: 'b', text: 'Au' },
    ]);
    expect(question.startsAt).toBeNull();
    expect(question.status).toBe('pending');
  });
});

describe('toAnswer', () => {
  it('maps scoring fields through untouched', () => {
    const answer = toAnswer({
      id: 'ans1',
      game_id: 'g1',
      question_id: 'q1',
      player_id: 'p1',
      answer_id: 'b',
      is_correct: true,
      response_time_ms: 3200,
      speed_bonus: 34,
      points: 134,
    });
    expect(answer).toEqual({
      id: 'ans1',
      gameId: 'g1',
      questionId: 'q1',
      playerId: 'p1',
      answerId: 'b',
      isCorrect: true,
      responseTimeMs: 3200,
      speedBonus: 34,
      points: 134,
    });
  });
});
