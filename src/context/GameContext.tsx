import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { AnswerValidationStatus, GameAnswer, GamePlayer, GameRoom, GameRoomStatus, GameRound, GameRoundStatus } from '../types/games';

interface GameRoomRow {
  id: string;
  room_code: string;
  host_id: string;
  status: GameRoomStatus;
  rounds_total: number;
  timer_seconds: number;
  categories: string[];
  current_round: number;
}

interface GamePlayerRow {
  id: string;
  game_id: string;
  user_id: string;
  name: string;
  ready: boolean;
  total_score: number;
  left_at: string | null;
}

interface GameRoundRow {
  id: string;
  game_id: string;
  round_number: number;
  letter: string;
  start_time: string;
  end_time: string;
  status: GameRoundStatus;
}

interface GameAnswerRow {
  id: string;
  round_id: string;
  player_id: string;
  category: string;
  answer: string;
  validation_status: AnswerValidationStatus;
  is_duplicate: boolean;
  points: number;
}

function toRoom(row: GameRoomRow): GameRoom {
  return {
    id: row.id,
    roomCode: row.room_code,
    hostId: row.host_id,
    status: row.status,
    roundsTotal: row.rounds_total,
    timerSeconds: row.timer_seconds,
    categories: row.categories,
    currentRound: row.current_round,
  };
}

function toPlayer(row: GamePlayerRow): GamePlayer {
  return {
    id: row.id,
    gameId: row.game_id,
    userId: row.user_id,
    name: row.name,
    ready: row.ready,
    totalScore: row.total_score,
    active: row.left_at === null,
  };
}

function toRound(row: GameRoundRow): GameRound {
  return {
    id: row.id,
    gameId: row.game_id,
    roundNumber: row.round_number,
    letter: row.letter,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
  };
}

function toAnswer(row: GameAnswerRow): GameAnswer {
  return {
    id: row.id,
    roundId: row.round_id,
    playerId: row.player_id,
    category: row.category,
    answer: row.answer,
    validationStatus: row.validation_status,
    isDuplicate: row.is_duplicate,
    points: row.points,
  };
}

function warn(action: string, error: { message: string } | null) {
  if (error) console.warn(`[games] failed to ${action}:`, error.message);
}

interface GameContextValue {
  game: GameRoom | null;
  players: GamePlayer[];
  round: GameRound | null;
  answers: GameAnswer[];
  myPlayerId: string | null;
  myAnswers: GameAnswer[];
  hasSubmittedAll: boolean;
  loading: boolean;
  error: string | null;

  createGame: (rounds: number, timerSeconds: number, name: string) => Promise<{ error: string | null; roomCode?: string }>;
  joinGame: (roomCode: string, name: string) => Promise<{ error: string | null }>;
  setReady: (ready: boolean) => Promise<void>;
  startRound: () => Promise<{ error: string | null }>;
  submitAnswers: (categoryAnswers: { category: string; answer: string }[]) => Promise<{ error: string | null }>;
  leaveGame: () => Promise<void>;
}

const GameContext = createContext<GameContextValue | null>(null);

/**
 * Multiplayer Name/Place/Animal/Thing. Every state change (join, ready,
 * round start, scoring) is server-authoritative — this context only
 * mirrors `game_rooms`/`game_players`/`game_rounds`/`game_answers` via
 * Realtime and calls the RPCs/edge function that actually mutate them; it
 * never computes a score or a timer deadline itself. Membership in a game
 * lives only in this session's state (no "my active games" lookup yet) —
 * leaving the screen or restarting the app loses track of an in-progress
 * game, same simplification the rest of the core loop was scoped to.
 */
export function GameProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [round, setRound] = useState<GameRound | null>(null);
  const [answerRows, setAnswerRows] = useState<GameAnswerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveAttempted = useRef<Set<string>>(new Set());

  // Room row: initial load + live status/current_round updates.
  useEffect(() => {
    if (!gameId || !isSupabaseConfigured) {
      setGame(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('game_rooms')
      .select('*')
      .eq('id', gameId)
      .single()
      .then(({ data, error: err }) => {
        warn('load game room', err);
        if (!cancelled && data) setGame(toRoom(data as GameRoomRow));
      });

    const channel = supabase
      .channel(`game-room-${gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${gameId}` }, (payload) => {
        setGame(toRoom(payload.new as GameRoomRow));
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Players: initial roster + live joins/ready-toggles/score updates/leaves.
  useEffect(() => {
    if (!gameId || !isSupabaseConfigured) {
      setPlayers([]);
      return;
    }
    let cancelled = false;
    supabase
      .from('game_players')
      .select('*')
      .eq('game_id', gameId)
      .then(({ data, error: err }) => {
        warn('load players', err);
        if (!cancelled) setPlayers(((data as GamePlayerRow[] | null) ?? []).map(toPlayer));
      });

    const upsert = (row: GamePlayerRow) =>
      setPlayers((prev) => (prev.some((p) => p.id === row.id) ? prev.map((p) => (p.id === row.id ? toPlayer(row) : p)) : [...prev, toPlayer(row)]));

    const channel = supabase
      .channel(`game-players-${gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` }, (p) =>
        upsert(p.new as GamePlayerRow),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` }, (p) =>
        upsert(p.new as GamePlayerRow),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Rounds: keeps `round` pointed at the latest round for this game.
  useEffect(() => {
    if (!gameId || !isSupabaseConfigured) {
      setRound(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('game_rounds')
      .select('*')
      .eq('game_id', gameId)
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error: err }) => {
        warn('load round', err);
        if (!cancelled) setRound(data ? toRound(data as GameRoundRow) : null);
      });

    const upsert = (row: GameRoundRow) =>
      setRound((prev) => (!prev || row.round_number >= prev.roundNumber ? toRound(row) : prev));

    const channel = supabase
      .channel(`game-rounds-${gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_rounds', filter: `game_id=eq.${gameId}` }, (p) =>
        upsert(p.new as GameRoundRow),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rounds', filter: `game_id=eq.${gameId}` }, (p) =>
        upsert(p.new as GameRoundRow),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Answers for the current round only — RLS hides everyone else's until
  // the round reaches 'results', so this table always reflects exactly
  // what this account is allowed to see, live.
  useEffect(() => {
    if (!round || !isSupabaseConfigured) {
      setAnswerRows([]);
      return;
    }
    let cancelled = false;
    supabase
      .from('game_answers')
      .select('*')
      .eq('round_id', round.id)
      .then(({ data, error: err }) => {
        warn('load answers', err);
        if (!cancelled) setAnswerRows((data as GameAnswerRow[] | null) ?? []);
      });

    const upsert = (row: GameAnswerRow) =>
      setAnswerRows((prev) => (prev.some((a) => a.id === row.id) ? prev.map((a) => (a.id === row.id ? row : a)) : [...prev, row]));

    const channel = supabase
      .channel(`game-answers-${round.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_answers', filter: `round_id=eq.${round.id}` }, (p) =>
        upsert(p.new as GameAnswerRow),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_answers', filter: `round_id=eq.${round.id}` }, (p) =>
        upsert(p.new as GameAnswerRow),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [round?.id]);

  const resolveRound = async (roundId: string) => {
    if (resolveAttempted.current.has(roundId)) return;
    resolveAttempted.current.add(roundId);
    const { error: err } = await supabase.functions.invoke('resolve-npat-round', { body: { round_id: roundId } });
    if (err) {
      // Transient failure (cold start, network blip) — let a later timer
      // tick or another connected player's client take the next shot.
      resolveAttempted.current.delete(roundId);
      console.warn('[games] resolve-npat-round failed:', err.message);
    }
  };

  // A round that's already locked (everyone submitted early, or a
  // previous tick already flipped it) should resolve right away.
  useEffect(() => {
    if (round?.status === 'locked') resolveRound(round.id);
  }, [round?.id, round?.status]);

  // Once the server's own deadline passes, ask the server to lock the
  // round — this is a nudge, not authority: submit_round_answers itself
  // rejects anything past end_time regardless of this timer firing.
  useEffect(() => {
    if (!round || round.status !== 'playing' || !isSupabaseConfigured) return;
    const msLeft = new Date(round.endTime).getTime() - Date.now();
    const timer = setTimeout(() => {
      supabase.rpc('lock_expired_round', { p_round_id: round.id }).then(({ error: err }) => warn('lock expired round', err));
    }, Math.max(0, msLeft) + 300);
    return () => clearTimeout(timer);
  }, [round?.id, round?.status, round?.endTime]);

  const createGame = async (rounds: number, timerSeconds: number, name: string): Promise<{ error: string | null; roomCode?: string }> => {
    if (!userId || !isSupabaseConfigured) return { error: 'Not signed in.' };
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('create_game_room', { p_rounds: rounds, p_timer_seconds: timerSeconds, p_name: name });
    setLoading(false);
    if (err) {
      setError(err.message);
      return { error: err.message };
    }
    const row = (data as { game_id: string; room_code: string }[])[0];
    setGameId(row.game_id);
    return { error: null, roomCode: row.room_code };
  };

  const joinGame = async (roomCode: string, name: string): Promise<{ error: string | null }> => {
    if (!userId || !isSupabaseConfigured) return { error: 'Not signed in.' };
    const trimmed = roomCode.trim();
    if (trimmed.length !== 6) return { error: 'Enter the full 6-digit room code.' };
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('join_game_room', { p_room_code: trimmed, p_name: name });
    setLoading(false);
    if (err) {
      setError(err.message);
      return { error: err.message };
    }
    setGameId(data as string);
    return { error: null };
  };

  const setReady = async (ready: boolean) => {
    if (!gameId || !isSupabaseConfigured) return;
    const { error: err } = await supabase.rpc('set_ready', { p_game_id: gameId, p_ready: ready });
    warn('set ready', err);
  };

  const startRound = async (): Promise<{ error: string | null }> => {
    if (!gameId || !isSupabaseConfigured) return { error: 'No game.' };
    const { error: err } = await supabase.rpc('start_round', { p_game_id: gameId });
    if (err) return { error: err.message };
    return { error: null };
  };

  const submitAnswers = async (categoryAnswers: { category: string; answer: string }[]): Promise<{ error: string | null }> => {
    if (!round || !isSupabaseConfigured) return { error: 'No active round.' };
    const { error: err } = await supabase.rpc('submit_round_answers', { p_round_id: round.id, p_answers: categoryAnswers });
    if (err) return { error: err.message };
    return { error: null };
  };

  const leaveGame = async () => {
    if (gameId && isSupabaseConfigured) {
      const { error: err } = await supabase.rpc('leave_game_room', { p_game_id: gameId });
      warn('leave game', err);
    }
    setGameId(null);
    setGame(null);
    setPlayers([]);
    setRound(null);
    setAnswerRows([]);
    setError(null);
  };

  const myPlayerId = players.find((p) => p.userId === userId)?.id ?? null;
  const answers = answerRows.map(toAnswer);
  const myAnswers = answers.filter((a) => a.playerId === myPlayerId);
  const hasSubmittedAll = !!game && game.categories.length > 0 && game.categories.every((c) => myAnswers.some((a) => a.category === c));

  const value: GameContextValue = {
    game,
    players,
    round,
    answers,
    myPlayerId,
    myAnswers,
    hasSubmittedAll,
    loading,
    error,
    createGame,
    joinGame,
    setReady,
    startRound,
    submitAnswers,
    leaveGame,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
}
