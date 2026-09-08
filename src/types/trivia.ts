export type TriviaGameStatus =
  | 'waiting'
  | 'starting'
  | 'question_active'
  | 'question_reveal'
  | 'leaderboard'
  | 'final_results'
  | 'completed'
  | 'cancelled';

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
