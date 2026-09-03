export type CardSuit = 'ember' | 'tide' | 'moss' | 'solar';
export type CardRank = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'block' | 'flip' | 'surge2' | 'prism' | 'prism4';

export interface PlayingCard {
  suit: CardSuit | null;
  rank: CardRank;
}

export type CardsGameStatus = 'waiting' | 'playing' | 'game_end' | 'cancelled';

export interface CardsGame {
  id: string;
  roomCode: string;
  hostId: string;
  status: CardsGameStatus;
  maxPlayers: number;
  minPlayers: number;
  currentSeat: number;
  direction: 'cw' | 'ccw';
  activeSuit: CardSuit | null;
  topCardSuit: CardSuit | null;
  topCardRank: CardRank | null;
  drewThisTurn: boolean;
  timerSeconds: number | null;
  lastCardPenalty: number;
  turnDeadline: string | null;
}

export interface CardsPlayer {
  id: string;
  gameId: string;
  userId: string;
  seat: number;
  name: string;
  status: 'active' | 'disconnected' | 'left';
  cardsRemaining: number;
  lastCardAnnounced: boolean;
  active: boolean;
}

export interface CardsRanking {
  playerId: string;
  position: number;
  cardsRemaining: number;
}

export interface CardsResult {
  winnerPlayerId: string | null;
  rankings: CardsRanking[];
}
