import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useFriends } from './FriendsContext';
import type {
  CircleMember,
  GameBreakdownEntry,
  GamePointResult,
  GamePointTransaction,
  LeaderboardEntry,
  PlayerGameStats,
} from '../types/gameStats';
import { gameTypeLabel } from '../types/gameStats';

interface StatsRow {
  user_id: string;
  total_points: number;
  games_played: number;
  games_won: number;
  games_lost: number;
  games_drawn: number;
  updated_at: string;
}

interface TransactionRow {
  id: string;
  user_id: string;
  game_id: string;
  game_type: string;
  result: GamePointResult;
  points_change: number;
  previous_points: number;
  new_points: number;
  created_at: string;
}

function zeroStats(userId: string): PlayerGameStats {
  return { userId, totalPoints: 0, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, gamesDrawn: 0, updatedAt: '' };
}

function toStats(row: StatsRow): PlayerGameStats {
  return {
    userId: row.user_id,
    totalPoints: row.total_points,
    gamesPlayed: row.games_played,
    gamesWon: row.games_won,
    gamesLost: row.games_lost,
    gamesDrawn: row.games_drawn,
    updatedAt: row.updated_at,
  };
}

function toTransaction(row: TransactionRow): GamePointTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    gameId: row.game_id,
    gameType: row.game_type,
    result: row.result,
    pointsChange: row.points_change,
    previousPoints: row.previous_points,
    newPoints: row.new_points,
    createdAt: row.created_at,
  };
}

/** Competition ranking (1,2,2,4) keyed on total_points only — ties share a rank, per spec. */
function rankFor(totalPoints: number, allTotals: number[]): number {
  return 1 + allTotals.filter((t) => t > totalPoints).length;
}

function warn(action: string, error: { message: string } | null) {
  if (error) console.warn(`[gameStats] failed to ${action}:`, error.message);
}

interface GameStatsContextValue {
  loading: boolean;
  /** Current user + accepted friends, each with stats (zeroed if never played). */
  circle: CircleMember[];
  /** `circle` sorted by Total Game Points desc, ranked for the Leadership Circle. */
  leaderboard: LeaderboardEntry[];
  myEntry: LeaderboardEntry | null;
  /** How many places the current user's rank moved since the previous update this session (+up/-down). Null until a second reading exists. */
  myRankDelta: number | null;
  /** The current user's Game Breakdown, derived from their own points ledger. */
  breakdown: GameBreakdownEntry[];
  /** The current user's most recent ledger entries, newest first. */
  recentActivity: GamePointTransaction[];
  statsFor: (userId: string) => PlayerGameStats;
  breakdownFor: (userId: string) => GameBreakdownEntry[];
  recentActivityFor: (userId: string, limit?: number) => GamePointTransaction[];
}

const GameStatsContext = createContext<GameStatsContextValue | null>(null);

const LEDGER_LIMIT = 400;

/**
 * Global cross-game points — the "Games dashboard" data layer. Read-only:
 * every point change is computed server-side (award_game_points, called from
 * each game's own completion RPC/edge function) and only ever displayed here.
 */
export function GameStatsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { friends } = useFriends();
  const userId = user?.id ?? null;

  const [statsByUser, setStatsByUser] = useState<Record<string, PlayerGameStats>>({});
  const [transactions, setTransactions] = useState<GamePointTransaction[]>([]);
  const [myProfile, setMyProfile] = useState<{ name: string; avatarUrl: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const prevRankRef = useRef<number | null>(null);
  const [myRankDelta, setMyRankDelta] = useState<number | null>(null);

  const circleIds = useMemo(() => {
    if (!userId) return [] as string[];
    return Array.from(new Set([userId, ...friends.map((f) => f.userId)]));
  }, [userId, friends]);
  const circleIdsKey = circleIds.slice().sort().join(',');

  useEffect(() => {
    if (!userId || !isSupabaseConfigured || circleIds.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      const [statsRes, txRes, profileRes] = await Promise.all([
        supabase.from('player_game_stats').select('*').in('user_id', circleIds),
        supabase
          .from('game_point_transactions')
          .select('*')
          .in('user_id', circleIds)
          .order('created_at', { ascending: false })
          .limit(LEDGER_LIMIT),
        supabase.from('profiles').select('full_name, username, avatar_url').eq('id', userId).maybeSingle(),
      ]);
      if (cancelled) return;
      if (statsRes.error) warn('load player_game_stats', statsRes.error);
      if (txRes.error) warn('load game_point_transactions', txRes.error);
      const nextStats: Record<string, PlayerGameStats> = {};
      for (const row of (statsRes.data as StatsRow[] | null) ?? []) nextStats[row.user_id] = toStats(row);
      setStatsByUser(nextStats);
      setTransactions(((txRes.data as TransactionRow[] | null) ?? []).map(toTransaction));
      if (profileRes.data) {
        setMyProfile({ name: profileRes.data.full_name ?? profileRes.data.username ?? 'You', avatarUrl: profileRes.data.avatar_url ?? null });
      }
      setLoading(false);
    }
    load();

    const poll = setInterval(load, 5000);
    const channel = supabase
      .channel(`game-stats-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_game_stats' }, (payload) => {
        const row = (payload.new ?? payload.old) as StatsRow | undefined;
        if (!row || !circleIds.includes(row.user_id)) return;
        if (payload.eventType === 'DELETE') return;
        setStatsByUser((prev) => ({ ...prev, [row.user_id]: toStats(payload.new as StatsRow) }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_point_transactions' }, (payload) => {
        const row = payload.new as TransactionRow;
        if (!circleIds.includes(row.user_id)) return;
        setTransactions((prev) => [toTransaction(row), ...prev].slice(0, LEDGER_LIMIT));
      })
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
    // circleIdsKey captures membership changes without re-running on every friends re-render.
  }, [userId, circleIdsKey]);

  const circle: CircleMember[] = useMemo(() => {
    return circleIds.map((id) => {
      if (id === userId) {
        return {
          userId: id,
          name: myProfile?.name ?? user?.user_metadata?.full_name ?? 'You',
          avatarUrl: myProfile?.avatarUrl ?? null,
          isSelf: true,
          stats: statsByUser[id] ?? zeroStats(id),
        };
      }
      const friend = friends.find((f) => f.userId === id);
      return {
        userId: id,
        name: friend?.name ?? 'Friend',
        avatarUrl: friend?.avatarUrl ?? null,
        isSelf: false,
        stats: statsByUser[id] ?? zeroStats(id),
      };
    });
  }, [circleIds, statsByUser, friends, userId, user, myProfile]);

  const leaderboard: LeaderboardEntry[] = useMemo(() => {
    const totals = circle.map((c) => c.stats.totalPoints);
    return circle
      .slice()
      .sort((a, b) => {
        if (b.stats.totalPoints !== a.stats.totalPoints) return b.stats.totalPoints - a.stats.totalPoints;
        if (b.stats.gamesWon !== a.stats.gamesWon) return b.stats.gamesWon - a.stats.gamesWon;
        if (b.stats.gamesPlayed !== a.stats.gamesPlayed) return b.stats.gamesPlayed - a.stats.gamesPlayed;
        return a.name.localeCompare(b.name);
      })
      .map((c) => ({ ...c, rank: rankFor(c.stats.totalPoints, totals) }));
  }, [circle]);

  const myEntry = useMemo(() => leaderboard.find((e) => e.isSelf) ?? null, [leaderboard]);

  const baselineSetRef = useRef(false);
  useEffect(() => {
    // Skip every render before the first full load settles — intermediate
    // states (e.g. self loaded before friends) would otherwise read as a
    // spurious rank "movement" the instant the dashboard opens.
    if (loading || !myEntry) return;
    if (!baselineSetRef.current) {
      baselineSetRef.current = true;
      prevRankRef.current = myEntry.rank;
      return;
    }
    if (prevRankRef.current !== null && prevRankRef.current !== myEntry.rank) {
      setMyRankDelta(prevRankRef.current - myEntry.rank);
    }
    prevRankRef.current = myEntry.rank;
  }, [loading, myEntry?.rank]);

  const breakdownFor = useMemo(() => {
    return (targetUserId: string): GameBreakdownEntry[] => {
      const byType = new Map<string, GameBreakdownEntry>();
      for (const tx of transactions) {
        if (tx.userId !== targetUserId) continue;
        const entry = byType.get(tx.gameType) ?? {
          gameType: tx.gameType,
          label: gameTypeLabel(tx.gameType),
          net: 0,
          pointsEarned: 0,
          pointsLost: 0,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          draws: 0,
        };
        entry.net += tx.pointsChange;
        if (tx.pointsChange > 0) entry.pointsEarned += tx.pointsChange;
        if (tx.pointsChange < 0) entry.pointsLost += tx.pointsChange;
        entry.gamesPlayed += 1;
        if (tx.result === 'win') entry.wins += 1;
        else if (tx.result === 'loss') entry.losses += 1;
        else entry.draws += 1;
        byType.set(tx.gameType, entry);
      }
      return Array.from(byType.values()).sort((a, b) => b.net - a.net);
    };
  }, [transactions]);

  const recentActivityFor = useMemo(() => {
    return (targetUserId: string, limit = 10): GamePointTransaction[] =>
      transactions.filter((tx) => tx.userId === targetUserId).slice(0, limit);
  }, [transactions]);

  const statsFor = useMemo(() => {
    return (targetUserId: string): PlayerGameStats => statsByUser[targetUserId] ?? zeroStats(targetUserId);
  }, [statsByUser]);

  const value: GameStatsContextValue = {
    loading,
    circle,
    leaderboard,
    myEntry,
    myRankDelta,
    breakdown: userId ? breakdownFor(userId) : [],
    recentActivity: userId ? recentActivityFor(userId) : [],
    statsFor,
    breakdownFor,
    recentActivityFor,
  };

  return <GameStatsContext.Provider value={value}>{children}</GameStatsContext.Provider>;
}

export function useGameStats(): GameStatsContextValue {
  const ctx = useContext(GameStatsContext);
  if (!ctx) throw new Error('useGameStats must be used within a GameStatsProvider');
  return ctx;
}
