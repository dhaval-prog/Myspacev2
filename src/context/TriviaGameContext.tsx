import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { TriviaAnswer, TriviaDifficulty, TriviaGame, TriviaGameStatus, TriviaPlayer, TriviaQuestion, TriviaQuestionStatus } from '../types/trivia';

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
  last_seen_at: string;
}

interface TriviaQuestionRow {
  id: string;
  game_id: string;
  question_index: number;
  question_text: string;
  category: string;
  difficulty: string;
  answers: { id: string; text: string }[];
  status: TriviaQuestionStatus;
  starts_at: string | null;
  ends_at: string | null;
  reveal_ends_at: string | null;
}

interface TriviaAnswerRow {
  id: string;
  game_id: string;
  question_id: string;
  player_id: string;
  answer_id: string;
  is_correct: boolean;
  response_time_ms: number;
  speed_bonus: number;
  points: number;
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
    lastSeenAt: row.last_seen_at,
  };
}

function toQuestion(row: TriviaQuestionRow): TriviaQuestion {
  return {
    id: row.id,
    gameId: row.game_id,
    questionIndex: row.question_index,
    questionText: row.question_text,
    category: row.category,
    difficulty: row.difficulty,
    answers: row.answers,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    revealEndsAt: row.reveal_ends_at,
  };
}

function toAnswer(row: TriviaAnswerRow): TriviaAnswer {
  return {
    id: row.id,
    gameId: row.game_id,
    questionId: row.question_id,
    playerId: row.player_id,
    answerId: row.answer_id,
    isCorrect: row.is_correct,
    responseTimeMs: row.response_time_ms,
    speedBonus: row.speed_bonus,
    points: row.points,
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

  /** The current (or most recently reached) question — null until the game starts. */
  currentQuestion: TriviaQuestion | null;
  /** My own submission for currentQuestion, if I've answered it. */
  myAnswer: TriviaAnswer | null;
  /** Every player's submission for currentQuestion — only populated (by RLS) once it's revealed. */
  answers: TriviaAnswer[];
  /** The correct answer id for currentQuestion — fetched on demand, only selectable once revealed. */
  correctAnswerId: string | null;
  submittingAnswer: boolean;
  answerError: string | null;

  /** Name of the player who just became host (via disconnect-based transfer) — null once dismissed or no change pending. */
  hostChangedTo: string | null;
  dismissHostChanged: () => void;

  createGame: (input: NewTriviaGameInput) => Promise<{ error: string | null; roomCode?: string }>;
  joinGame: (roomCode: string, name: string) => Promise<{ error: string | null }>;
  updateSettings: (input: Omit<NewTriviaGameInput, 'name'>) => Promise<{ error: string | null }>;
  leaveGame: () => Promise<void>;
  /** Host-only: fetches questions from Open Trivia DB (via edge function) and starts the game. */
  startGame: () => Promise<{ error: string | null }>;
  submitAnswer: (answerId: string) => Promise<{ error: string | null }>;
}

const TriviaGameContext = createContext<TriviaGameContextValue | null>(null);

/**
 * Multiplayer Trivia Night. Same shape as GameContext/CardsGameContext: this
 * context only mirrors `trivia_games`/`trivia_players`/`trivia_questions`/
 * `trivia_answers` via Realtime (plus a 3s poll backstop) and calls the RPCs/
 * edge function that actually mutate them — it never computes a score or a
 * timer deadline itself. `correct_answer_id` lives in a separate table RLS
 * only lets a client select once the question is revealed, so it's never
 * fetched (or fetchable) while a question is still active.
 */
export function TriviaGameProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState<TriviaGame | null>(null);
  const [players, setPlayers] = useState<TriviaPlayer[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<TriviaQuestion | null>(null);
  const [answerRows, setAnswerRows] = useState<TriviaAnswerRow[]>([]);
  const [correctAnswerId, setCorrectAnswerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [hostChangedTo, setHostChangedTo] = useState<string | null>(null);
  const prevHostId = useRef<string | null>(null);

  // Room row: initial load + live status/settings/current-question-index updates.
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

  // Current question: keeps `currentQuestion` pointed at the latest question
  // for this game (by question_index) — RLS already restricts this to the
  // current or a past one, never a future one.
  useEffect(() => {
    if (!gameId || !isSupabaseConfigured) {
      setCurrentQuestion(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('trivia_questions')
      .select('*')
      .eq('game_id', gameId)
      .order('question_index', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error: err }) => {
        warn('load trivia question', err);
        if (!cancelled) setCurrentQuestion(data ? toQuestion(data as TriviaQuestionRow) : null);
      });

    const upsert = (row: TriviaQuestionRow) =>
      setCurrentQuestion((prev) => (!prev || row.question_index >= prev.questionIndex ? toQuestion(row) : prev));

    const channel = supabase
      .channel(`trivia-questions-${gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trivia_questions', filter: `game_id=eq.${gameId}` }, (p) =>
        upsert(p.new as TriviaQuestionRow),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trivia_questions', filter: `game_id=eq.${gameId}` }, (p) =>
        upsert(p.new as TriviaQuestionRow),
      )
      .subscribe();

    const poll = setInterval(() => {
      supabase
        .from('trivia_questions')
        .select('*')
        .eq('game_id', gameId)
        .order('question_index', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled && data) setCurrentQuestion((prev) => (!prev || data.question_index >= prev.questionIndex ? toQuestion(data as TriviaQuestionRow) : prev));
        });
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Answers for the current question only — RLS hides everyone else's until
  // it's revealed, so this always reflects exactly what this account can see.
  useEffect(() => {
    if (!currentQuestion || !isSupabaseConfigured) {
      setAnswerRows([]);
      return;
    }
    let cancelled = false;
    supabase
      .from('trivia_answers')
      .select('*')
      .eq('question_id', currentQuestion.id)
      .then(({ data, error: err }) => {
        warn('load trivia answers', err);
        if (!cancelled) setAnswerRows((data as TriviaAnswerRow[] | null) ?? []);
      });

    const upsert = (row: TriviaAnswerRow) =>
      setAnswerRows((prev) => (prev.some((a) => a.id === row.id) ? prev.map((a) => (a.id === row.id ? row : a)) : [...prev, row]));

    const channel = supabase
      .channel(`trivia-answers-${currentQuestion.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trivia_answers', filter: `question_id=eq.${currentQuestion.id}` }, (p) =>
        upsert(p.new as TriviaAnswerRow),
      )
      .subscribe();

    const poll = setInterval(() => {
      supabase
        .from('trivia_answers')
        .select('*')
        .eq('question_id', currentQuestion.id)
        .then(({ data }) => {
          if (!cancelled && data) setAnswerRows(data as TriviaAnswerRow[]);
        });
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [currentQuestion?.id]);

  // The correct answer is only fetchable once the question is revealed — a
  // plain one-off select, no realtime needed since it never changes after.
  useEffect(() => {
    setCorrectAnswerId(null);
    if (!currentQuestion || currentQuestion.status !== 'revealed' || !isSupabaseConfigured) return;
    let cancelled = false;
    supabase
      .from('trivia_correct_answers')
      .select('correct_answer_id')
      .eq('question_id', currentQuestion.id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        warn('load correct answer', err);
        if (!cancelled && data) setCorrectAnswerId(data.correct_answer_id as string);
      });
    return () => {
      cancelled = true;
    };
  }, [currentQuestion?.id, currentQuestion?.status]);

  // Nudges the server past a question's deadline (active → revealed) or its
  // reveal window (revealed → next question / completed) — a nudge, not
  // authority: advance_trivia_question itself re-checks the real deadline
  // regardless of when this fires, exactly like lock_expired_round.
  useEffect(() => {
    if (!currentQuestion || !gameId || !isSupabaseConfigured || game?.status !== 'active') return;
    const deadline = currentQuestion.status === 'active' ? currentQuestion.endsAt : currentQuestion.revealEndsAt;
    if (!deadline) return;
    const msLeft = new Date(deadline).getTime() - Date.now();
    const timer = setTimeout(() => {
      supabase.rpc('advance_trivia_question', { p_game_id: gameId }).then(({ error: err }) => warn('advance trivia question', err));
    }, Math.max(0, msLeft) + 300);
    return () => clearTimeout(timer);
  }, [gameId, game?.status, currentQuestion?.id, currentQuestion?.status, currentQuestion?.endsAt, currentQuestion?.revealEndsAt]);

  // Detects a disconnect-driven host handoff (private.maybe_transfer_trivia_host)
  // so the lobby can show a one-time "X is now the host" banner. Skips the
  // very first observation of hostId (game just loaded, not a real change).
  useEffect(() => {
    if (!game) {
      prevHostId.current = null;
      return;
    }
    if (prevHostId.current === null) {
      prevHostId.current = game.hostId;
      return;
    }
    if (game.hostId !== prevHostId.current) {
      prevHostId.current = game.hostId;
      const newHost = players.find((p) => p.userId === game.hostId);
      if (newHost) setHostChangedTo(newHost.name);
    }
  }, [game?.hostId, players]);

  // Heartbeat: tells the server this account is still around every ~10s so a
  // disconnected host can be replaced — a nudge, same spirit as the question
  // advance timer. Also fires once immediately when a game is joined.
  useEffect(() => {
    if (!gameId || !isSupabaseConfigured) return;
    const beat = () => supabase.rpc('heartbeat_trivia_presence', { p_game_id: gameId }).then(({ error: err }) => warn('send trivia heartbeat', err));
    beat();
    const id = setInterval(beat, 10000);
    return () => clearInterval(id);
  }, [gameId]);

  // On mobile, backgrounding this app pauses realtime + the poll backstop —
  // returning to foreground should immediately re-sync everything rather
  // than waiting for the next 3s tick, same pattern as LiveLocationsScreen.
  useEffect(() => {
    if (!gameId || !isSupabaseConfigured) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      supabase.rpc('heartbeat_trivia_presence', { p_game_id: gameId }).then(({ error: err }) => warn('send trivia heartbeat', err));
      supabase
        .from('trivia_games')
        .select('*')
        .eq('id', gameId)
        .single()
        .then(({ data }) => {
          if (data) setGame(toGame(data as TriviaGameRow));
        });
      supabase
        .from('trivia_players')
        .select('*')
        .eq('game_id', gameId)
        .then(({ data }) => {
          if (data) setPlayers((data as TriviaPlayerRow[]).map(toPlayer));
        });
    });
    return () => sub.remove();
  }, [gameId]);

  const dismissHostChanged = () => setHostChangedTo(null);

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
    setCurrentQuestion(null);
    setAnswerRows([]);
    setCorrectAnswerId(null);
    setError(null);
    setHostChangedTo(null);
    prevHostId.current = null;
  };

  const startGame = async (): Promise<{ error: string | null }> => {
    if (!gameId || !isSupabaseConfigured) return { error: 'No game.' };
    const { data, error: err } = await supabase.functions.invoke('start-trivia-game', { body: { game_id: gameId } });
    if (err) return { error: err.message };
    if (data?.error) return { error: data.error as string };
    return { error: null };
  };

  const submitAnswer = async (answerId: string): Promise<{ error: string | null }> => {
    if (!currentQuestion || !isSupabaseConfigured) return { error: 'No active question.' };
    setSubmittingAnswer(true);
    setAnswerError(null);
    const { error: err } = await supabase.rpc('submit_trivia_answer', { p_question_id: currentQuestion.id, p_answer_id: answerId });
    setSubmittingAnswer(false);
    if (err) {
      setAnswerError(err.message);
      return { error: err.message };
    }
    return { error: null };
  };

  const myPlayerId = players.find((p) => p.userId === userId)?.id ?? null;
  const answers = answerRows.map(toAnswer);
  const myAnswer = answers.find((a) => a.playerId === myPlayerId) ?? null;

  const value: TriviaGameContextValue = {
    game,
    players,
    myPlayerId,
    loading,
    error,
    currentQuestion,
    myAnswer,
    answers,
    correctAnswerId,
    submittingAnswer,
    answerError,
    hostChangedTo,
    dismissHostChanged,
    createGame,
    joinGame,
    updateSettings,
    leaveGame,
    startGame,
    submitAnswer,
  };

  return <TriviaGameContext.Provider value={value}>{children}</TriviaGameContext.Provider>;
}

export function useTriviaGame(): TriviaGameContextValue {
  const ctx = useContext(TriviaGameContext);
  if (!ctx) throw new Error('useTriviaGame must be used within a TriviaGameProvider');
  return ctx;
}
