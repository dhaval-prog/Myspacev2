export type GameType = 'NPAT' | 'CARDS';
export type GamePointResult = 'win' | 'loss' | 'draw';

/** A user's persistent, cross-game score — separate from any single game's internal score. */
export interface PlayerGameStats {
  userId: string;
  totalPoints: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDrawn: number;
  updatedAt: string;
}

/** One row of the append-only points ledger — the source of truth Total Game Points reconciles against. */
export interface GamePointTransaction {
  id: string;
  userId: string;
  gameId: string;
  gameType: string;
  result: GamePointResult;
  pointsChange: number;
  previousPoints: number;
  newPoints: number;
  createdAt: string;
}

/** A friend (or the current user) placed in the friend circle / leaderboard, with stats always present (zeroed if never played). */
export interface CircleMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
  isSelf: boolean;
  stats: PlayerGameStats;
}

/** A CircleMember plus its computed Leadership Circle position. */
export interface LeaderboardEntry extends CircleMember {
  /** Competition ranking (1,2,2,4) — ties on total_points share a rank. */
  rank: number;
}

/** Per-game-type net contribution to the user's Total Game Points, derived from the ledger. */
export interface GameBreakdownEntry {
  gameType: string;
  label: string;
  net: number;
  pointsEarned: number;
  pointsLost: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

export const GAME_TYPE_LABELS: Record<string, string> = {
  NPAT: 'Name, Place, Animal, Thing',
  CARDS: 'Space Cards',
};

export function gameTypeLabel(gameType: string): string {
  return GAME_TYPE_LABELS[gameType] ?? gameType;
}
