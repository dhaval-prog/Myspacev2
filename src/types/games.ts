export type GameRoomStatus = 'waiting' | 'playing' | 'round_results' | 'game_complete';
export type GameRoundStatus = 'playing' | 'locked' | 'validating' | 'results';
export type AnswerValidationStatus = 'pending' | 'valid' | 'invalid' | 'review';

export interface GameRoom {
  id: string;
  roomCode: string;
  hostId: string;
  status: GameRoomStatus;
  roundsTotal: number;
  timerSeconds: number;
  categories: string[];
  currentRound: number;
}

export interface GamePlayer {
  id: string;
  gameId: string;
  userId: string;
  name: string;
  ready: boolean;
  totalScore: number;
  active: boolean;
  /** The round this player has fully submitted every category for, or null. */
  submittedRoundId: string | null;
}

export interface GameRound {
  id: string;
  gameId: string;
  roundNumber: number;
  letter: string;
  startTime: string;
  endTime: string;
  status: GameRoundStatus;
}

export interface GameAnswer {
  id: string;
  roundId: string;
  playerId: string;
  category: string;
  answer: string;
  validationStatus: AnswerValidationStatus;
  isDuplicate: boolean;
  points: number;
}
