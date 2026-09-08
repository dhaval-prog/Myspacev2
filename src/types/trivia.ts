export type TriviaGameStatus = 'waiting' | 'starting' | 'active' | 'completed' | 'cancelled';
export type TriviaQuestionStatus = 'pending' | 'active' | 'revealed';

export type TriviaCategory =
  | 'Random'
  | 'General Knowledge'
  | 'Books'
  | 'Film'
  | 'Music'
  | 'Television'
  | 'Video Games'
  | 'Sports'
  | 'Science'
  | 'History'
  | 'Geography'
  | 'Technology'
  | 'Food'
  | 'Nature'
  | 'Animals'
  | 'Art'
  | 'Computers'
  | 'Mathematics';

export type TriviaDifficulty = 'easy' | 'medium' | 'hard' | 'mixed';

export interface TriviaGame {
  id: string;
  roomCode: string;
  hostId: string;
  status: TriviaGameStatus;
  category: string;
  difficulty: TriviaDifficulty;
  questionCount: number;
  timePerQuestion: number;
  currentQuestionIndex: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface TriviaPlayer {
  id: string;
  gameId: string;
  userId: string;
  name: string;
  score: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unanswered: number;
  fastestAnswers: number;
  active: boolean;
}

export interface TriviaAnswerOption {
  id: string;
  text: string;
}

export interface TriviaQuestion {
  id: string;
  gameId: string;
  questionIndex: number;
  questionText: string;
  category: string;
  difficulty: string;
  answers: TriviaAnswerOption[];
  status: TriviaQuestionStatus;
  startsAt: string | null;
  endsAt: string | null;
  revealEndsAt: string | null;
}

export interface TriviaAnswer {
  id: string;
  gameId: string;
  questionId: string;
  playerId: string;
  answerId: string;
  isCorrect: boolean;
  responseTimeMs: number;
  speedBonus: number;
  points: number;
}
