import React, { createContext, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { TriviaDifficulty, TriviaGame, TriviaGameStatus, TriviaPlayer } from '../types/trivia';

interface TriviaGameRow {
  id: string;
  room_code: string;
  host_id: string;
  status: TriviaGameStatus;
  category: string;
  difficulty: TriviaDifficulty;
  question_count: number;
  time_per_question: number;
  current_question_index: number;
  started_at: string | null;
  completed_at: string | null;
}

interface TriviaPlayerRow {
  id: string;
  game_id: string;
  user_id: string;
  name: string;
  score: number;
  correct_answers: number;
  incorrect_answers: number;
  unanswered: number;
  fastest_answers: number;
  left_at: string | null;
}

function toGame(row: TriviaGameRow): TriviaGame {
  return {
    id: row.id,
    roomCode: row.room_code,
    hostId: row.host_id,
    status: row.status,
    category: row.category,
    difficulty: row.difficulty,
    questionCount: row.question_count,
    timePerQuestion: row.time_per_question,
    currentQuestionIndex: row.current_question_index,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function toPlayer(row: TriviaPlayerRow): TriviaPlayer {
  return {
    id: row.id,
    gameId: row.game_id,
    userId: row.user_id,
    name: row.name,
    score: row.score,
    correctAnswers: row.correct_answers,
    incorrectAnswers: row.incorrect_answers,
    unanswered: row.unanswered,
    fastestAnswers: row.fastest_answers,
    active: row.left_at === null,
  };
}

function warn(action: string, error: { message: string } | null) {
  if (error) console.warn(`[trivia] failed to ${action}:`, error.message);
}

interface NewTriviaGameInput {
  category: string;
  difficulty: TriviaDifficulty;
  questionCount: number;
  timePerQuestion: number;
  name: string;
}

interface TriviaGameContextValue {
  game: TriviaGame | null;
  players: TriviaPlayer[];
  myPlayerId: string | null;
  loading: boolean;
  error: string | null;

  createGame: (input: NewTriviaGameInput) => Promise<{ error: string | null; roomCode?: string }>;
  joinGame: (roomCode: string, name: string) => Promise<{ error: string | null }>;
  updateSettings: (input: Omit<NewTriviaGameInput, 'name'>) => Promise<{ error: string | null }>;
  leaveGame: () => Promise<void>;
}

const TriviaGameContext = createContext<TriviaGameContextValue | null>(null);

/**
 * Multiplayer Trivia Night. Same shape as GameContext/CardsGameContext: this
 * context only mirrors `trivia_games`/`trivia_players` via Realtime (plus a
 * 3s poll backstop so a dropped event can never strand a player on a stale
 * screen) and calls the RPCs that actually mutate them — it never computes
 * state itself. Phase 1 only covers create/join/lobby/settings/leave; the
 * question engine (start, answer, scoring, reveal) lands in later phases.
 */
export function TriviaGameProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState<TriviaGame | null>(null);
  const [players, setPlayers] = useState<TriviaPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Room row: initial load + live status/settings updates.
  useEffect(() => {
    if (!gameId || !isSupabaseConfigured) {
      setGame(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('trivia_games')
      .select('*')
      .eq('id', gameId)
      .single()
      .then(({ data, error: err }) => {
        warn('load trivia game', err);
        if (!cancelled && data) setGame(toGame(data as TriviaGameRow));
      });

    const channel = supabase
      .channel(`trivia-game-${gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trivia_games', filter: `id=eq.${gameId}` }, (payload) => {
        setGame(toGame(payload.new as TriviaGameRow));
      })
      .subscribe();

    const poll = setInterval(() => {
      supabase
        .from('trivia_games')
        .select('*')
        .eq('id', gameId)
        .single()
        .then(({ data }) => {
          if (!cancelled && data) setGame(toGame(data as TriviaGameRow));
        });
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Players: initial roster + live joins/score updates/leaves.
  useEffect(() => {
    if (!gameId || !isSupabaseConfigured) {
      setPlayers([]);
      return;
    }
    let cancelled = false;
    supabase
      .from('trivia_players')
      .select('*')
      .eq('game_id', gameId)
      .then(({ data, error: err }) => {
        warn('load trivia players', err);
        if (!cancelled) setPlayers(((data as TriviaPlayerRow[] | null) ?? []).map(toPlayer));
      });

    const upsert = (row: TriviaPlayerRow) =>
      setPlayers((prev) => (prev.some((p) => p.id === row.id) ? prev.map((p) => (p.id === row.id ? toPlayer(row) : p)) : [...prev, toPlayer(row)]));

    const channel = supabase
      .channel(`trivia-players-${gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trivia_players', filter: `game_id=eq.${gameId}` }, (p) =>
        upsert(p.new as TriviaPlayerRow),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trivia_players', filter: `game_id=eq.${gameId}` }, (p) =>
        upsert(p.new as TriviaPlayerRow),
      )
      .subscribe();

    const poll = setInterval(() => {
      supabase
        .from('trivia_players')
        .select('*')
        .eq('game_id', gameId)
        .then(({ data }) => {
          if (!cancelled && data) setPlayers((data as TriviaPlayerRow[]).map(toPlayer));
        });
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  const createGame = async (input: NewTriviaGameInput): Promise<{ error: string | null; roomCode?: string }> => {
    if (!userId || !isSupabaseConfigured) return { error: 'Not signed in.' };
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('create_trivia_game', {
      p_category: input.category,
      p_difficulty: input.difficulty,
      p_question_count: input.questionCount,
      p_time_per_question: input.timePerQuestion,
      p_name: input.name,
    });
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
    const trimmed = roomCode.trim().toUpperCase();
    if (trimmed.length !== 6) return { error: 'Enter the full 6-character invite code.' };
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('join_trivia_game', { p_room_code: trimmed, p_name: name });
    setLoading(false);
    if (err) {
      setError(err.message);
      return { error: err.message };
    }
    setGameId(data as string);
    return { error: null };
  };

  const updateSettings = async (input: Omit<NewTriviaGameInput, 'name'>): Promise<{ error: string | null }> => {
    if (!gameId || !isSupabaseConfigured) return { error: 'No game.' };
    const { error: err } = await supabase.rpc('update_trivia_game_settings', {
      p_game_id: gameId,
      p_category: input.category,
      p_difficulty: input.difficulty,
      p_question_count: input.questionCount,
      p_time_per_question: input.timePerQuestion,
    });
    if (err) return { error: err.message };
    return { error: null };
  };

  const leaveGame = async () => {
    if (gameId && isSupabaseConfigured) {
      const { error: err } = await supabase.rpc('leave_trivia_game', { p_game_id: gameId });
      warn('leave trivia game', err);
    }
    setGameId(null);
    setGame(null);
    setPlayers([]);
    setError(null);
  };

  const myPlayerId = players.find((p) => p.userId === userId)?.id ?? null;

  const value: TriviaGameContextValue = {
    game,
    players,
    myPlayerId,
    loading,
    error,
    createGame,
    joinGame,
    updateSettings,
    leaveGame,
  };

  return <TriviaGameContext.Provider value={value}>{children}</TriviaGameContext.Provider>;
}

export function useTriviaGame(): TriviaGameContextValue {
  const ctx = useContext(TriviaGameContext);
  if (!ctx) throw new Error('useTriviaGame must be used within a TriviaGameProvider');
  return ctx;
}
