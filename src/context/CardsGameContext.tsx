import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { randomId } from '../utils/randomId';
import { useAuth } from './AuthContext';
import type { CardRank, CardSuit, CardsGame, CardsGameStatus, CardsPlayer, CardsResult, PlayingCard } from '../types/cards';

interface CardsGameRow {
  id: string;
  room_code: string;
  host_id: string;
  status: CardsGameStatus;
  max_players: number;
  min_players: number;
  current_seat: number;
  direction: 'cw' | 'ccw';
  active_suit: CardSuit | null;
  top_card_suit: CardSuit | null;
  top_card_rank: CardRank | null;
  drew_this_turn: boolean;
  timer_seconds: number | null;
  last_card_penalty: number;
  turn_deadline: string | null;
}

interface CardsPlayerRow {
  id: string;
  game_id: string;
  user_id: string;
  seat: number;
  name: string;
  status: 'active' | 'disconnected' | 'left';
  cards_remaining: number;
  last_card_announced: boolean;
  left_at: string | null;
}

interface CardsHandRow {
  game_id: string;
  player_id: string;
  hand: PlayingCard[];
}

interface CardsResultRow {
  winner_player_id: string | null;
  rankings: { player_id: string; position: number; cards_remaining: number }[];
}

function toGame(row: CardsGameRow): CardsGame {
  return {
    id: row.id,
    roomCode: row.room_code,
    hostId: row.host_id,
    status: row.status,
    maxPlayers: row.max_players,
    minPlayers: row.min_players,
    currentSeat: row.current_seat,
    direction: row.direction,
    activeSuit: row.active_suit,
    topCardSuit: row.top_card_suit,
    topCardRank: row.top_card_rank,
    drewThisTurn: row.drew_this_turn,
    timerSeconds: row.timer_seconds,
    lastCardPenalty: row.last_card_penalty,
    turnDeadline: row.turn_deadline,
  };
}

function toPlayer(row: CardsPlayerRow): CardsPlayer {
  return {
    id: row.id,
    gameId: row.game_id,
    userId: row.user_id,
    seat: row.seat,
    name: row.name,
    status: row.status,
    cardsRemaining: row.cards_remaining,
    lastCardAnnounced: row.last_card_announced,
    active: row.left_at === null,
  };
}

function toResult(row: CardsResultRow): CardsResult {
  return {
    winnerPlayerId: row.winner_player_id,
    rankings: row.rankings.map((r) => ({ playerId: r.player_id, position: r.position, cardsRemaining: r.cards_remaining })),
  };
}

function warn(action: string, error: { message: string } | null) {
  if (error) console.warn(`[cards] failed to ${action}:`, error.message);
}

interface CardsGameContextValue {
  game: CardsGame | null;
  players: CardsPlayer[];
  myHand: PlayingCard[];
  result: CardsResult | null;
  myPlayerId: string | null;
  loading: boolean;
  error: string | null;

  createGame: (maxPlayers: number, timerSeconds: number | null, lastCardPenalty: number, name: string) => Promise<{ error: string | null; roomCode?: string }>;
  joinGame: (roomCode: string, name: string) => Promise<{ error: string | null }>;
  startGame: () => Promise<{ error: string | null }>;
  playCard: (suit: CardSuit | null, rank: CardRank, chosenSuit?: CardSuit) => Promise<{ error: string | null }>;
  drawCard: () => Promise<{ error: string | null }>;
  passTurn: () => Promise<{ error: string | null }>;
  announceLastCard: () => Promise<void>;
  catchLastCard: (targetPlayerId: string) => Promise<{ error: string | null }>;
  leaveGame: () => Promise<void>;
}

const CardsGameContext = createContext<CardsGameContextValue | null>(null);

/**
 * My Space Cards — a shed-your-hand card game. Every mutation is a
 * SECURITY DEFINER RPC; this context only mirrors `cards_games` /
 * `cards_players` / this account's own `cards_hands` row via Realtime.
 * The deck and other players' hands are never fetched — RLS makes that
 * structurally impossible, not just hidden client-side.
 */
export function CardsGameProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState<CardsGame | null>(null);
  const [players, setPlayers] = useState<CardsPlayer[]>([]);
  const [myHand, setMyHand] = useState<PlayingCard[]>([]);
  const [result, setResult] = useState<CardsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lockAttempted = useRef<string | null>(null);

  useEffect(() => {
    if (!gameId || !isSupabaseConfigured) {
      setGame(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('cards_games')
      .select('*')
      .eq('id', gameId)
      .single()
      .then(({ data, error: err }) => {
        warn('load cards game', err);
        if (!cancelled && data) setGame(toGame(data as CardsGameRow));
      });

    const channel = supabase
      .channel(`cards-game-${gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cards_games', filter: `id=eq.${gameId}` }, (payload) => {
        setGame(toGame(payload.new as CardsGameRow));
      })
      .subscribe();

    // Realtime push is the fast path, but a dropped/delayed event (a flaky
    // connection, a channel that reconnects mid-game) must never leave a
    // player stuck mid-turn — a cheap poll on the single game row is the
    // backstop that guarantees this state can't get permanently stale.
    const poll = setInterval(() => {
      supabase
        .from('cards_games')
        .select('*')
        .eq('id', gameId)
        .single()
        .then(({ data }) => {
          if (!cancelled && data) setGame(toGame(data as CardsGameRow));
        });
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  useEffect(() => {
    if (!gameId || !isSupabaseConfigured) {
      setPlayers([]);
      return;
    }
    let cancelled = false;
    supabase
      .from('cards_players')
      .select('*')
      .eq('game_id', gameId)
      .then(({ data, error: err }) => {
        warn('load cards players', err);
        if (!cancelled) setPlayers(((data as CardsPlayerRow[] | null) ?? []).map(toPlayer));
      });

    const upsert = (row: CardsPlayerRow) =>
      setPlayers((prev) => (prev.some((p) => p.id === row.id) ? prev.map((p) => (p.id === row.id ? toPlayer(row) : p)) : [...prev, toPlayer(row)]));

    const channel = supabase
      .channel(`cards-players-${gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cards_players', filter: `game_id=eq.${gameId}` }, (p) => upsert(p.new as CardsPlayerRow))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cards_players', filter: `game_id=eq.${gameId}` }, (p) => upsert(p.new as CardsPlayerRow))
      .subscribe();

    // Same backstop as the game-row poll — a host stuck in the waiting room
    // not seeing a joined player is exactly as broken as a stuck turn, and
    // "waiting" has no turn-change signal of its own to hang a resync off.
    const poll = setInterval(() => {
      supabase
        .from('cards_players')
        .select('*')
        .eq('game_id', gameId)
        .then(({ data }) => {
          if (!cancelled && data) setPlayers((data as CardsPlayerRow[]).map(toPlayer));
        });
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Same backstop as the game-row poll above, one level down: every turn
  // transition is a reliable signal that players/hands just changed, so
  // re-pull them fresh whenever it fires — independent of whether their
  // own realtime events actually arrived.
  useEffect(() => {
    if (!gameId || !game || !isSupabaseConfigured) return;
    supabase
      .from('cards_players')
      .select('*')
      .eq('game_id', gameId)
      .then(({ data }) => {
        if (data) setPlayers(((data as CardsPlayerRow[] | null) ?? []).map(toPlayer));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, game?.currentSeat, game?.drewThisTurn]);

  // Own hand only — RLS already restricts this table to the owning user's
  // row, so a plain "all rows for this game" query never returns anyone else's.
  useEffect(() => {
    if (!gameId || !isSupabaseConfigured) {
      setMyHand([]);
      return;
    }
    let cancelled = false;
    supabase
      .from('cards_hands')
      .select('*')
      .eq('game_id', gameId)
      .then(({ data, error: err }) => {
        warn('load my hand', err);
        const row = (data as CardsHandRow[] | null)?.[0];
        if (!cancelled) setMyHand(row?.hand ?? []);
      });

    const channel = supabase
      .channel(`cards-hand-${gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cards_hands', filter: `game_id=eq.${gameId}` }, (p) => {
        setMyHand((p.new as CardsHandRow).hand);
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Same backstop, for the hand specifically — a forced draw (Surge+2,
  // Prism Surge+4) changes this account's own hand from another player's
  // action, so it must never depend on a single realtime event landing.
  useEffect(() => {
    if (!gameId || !game || !isSupabaseConfigured) return;
    supabase
      .from('cards_hands')
      .select('*')
      .eq('game_id', gameId)
      .then(({ data }) => {
        const row = (data as CardsHandRow[] | null)?.[0];
        if (row) setMyHand(row.hand);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, game?.currentSeat, game?.drewThisTurn, game?.topCardRank]);

  useEffect(() => {
    if (!gameId || !isSupabaseConfigured) {
      setResult(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('cards_results')
      .select('*')
      .eq('game_id', gameId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        warn('load cards result', err);
        if (!cancelled) setResult(data ? toResult(data as CardsResultRow) : null);
      });

    const channel = supabase
      .channel(`cards-results-${gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cards_results', filter: `game_id=eq.${gameId}` }, (p) => {
        setResult(toResult(p.new as CardsResultRow));
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // A turn whose deadline has passed gets nudged forward — server-side
  // draw/skip logic decides what actually happens; this is just a ping,
  // same pattern as the NPAT round timer.
  useEffect(() => {
    if (!game || game.status !== 'playing' || !game.turnDeadline || !isSupabaseConfigured) return;
    const msLeft = new Date(game.turnDeadline).getTime() - Date.now();
    const key = `${game.id}:${game.turnDeadline}`;
    const timer = setTimeout(() => {
      if (lockAttempted.current === key) return;
      lockAttempted.current = key;
      supabase.rpc('lock_expired_turn', { p_game_id: game.id }).then(({ error: err }) => warn('lock expired turn', err));
    }, Math.max(0, msLeft) + 300);
    return () => clearTimeout(timer);
  }, [game?.id, game?.turnDeadline, game?.status]);

  const createGame = async (
    maxPlayers: number,
    timerSeconds: number | null,
    lastCardPenalty: number,
    name: string,
  ): Promise<{ error: string | null; roomCode?: string }> => {
    if (!userId || !isSupabaseConfigured) return { error: 'Not signed in.' };
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('create_cards_game', {
      p_max_players: maxPlayers,
      p_timer_seconds: timerSeconds,
      p_last_card_penalty: lastCardPenalty,
      p_name: name,
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
    if (trimmed.length !== 4) return { error: 'Enter the full 4-character room code.' };
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('join_cards_game', { p_room_code: trimmed, p_name: name });
    setLoading(false);
    if (err) {
      setError(err.message);
      return { error: err.message };
    }
    setGameId(data as string);
    return { error: null };
  };

  const startGame = async (): Promise<{ error: string | null }> => {
    if (!gameId || !isSupabaseConfigured) return { error: 'No game.' };
    const { error: err } = await supabase.rpc('start_cards_game', { p_game_id: gameId });
    if (err) return { error: err.message };
    return { error: null };
  };

  const playCard = async (suit: CardSuit | null, rank: CardRank, chosenSuit?: CardSuit): Promise<{ error: string | null }> => {
    if (!gameId || !isSupabaseConfigured) return { error: 'No game.' };
    const { error: err } = await supabase.rpc('play_card', {
      p_game_id: gameId,
      p_client_move_id: randomId(),
      p_suit: suit,
      p_rank: rank,
      p_chosen_suit: chosenSuit ?? null,
    });
    if (err) return { error: err.message };
    return { error: null };
  };

  const drawCard = async (): Promise<{ error: string | null }> => {
    if (!gameId || !isSupabaseConfigured) return { error: 'No game.' };
    const { error: err } = await supabase.rpc('draw_card', { p_game_id: gameId, p_client_move_id: randomId() });
    if (err) return { error: err.message };
    return { error: null };
  };

  const passTurn = async (): Promise<{ error: string | null }> => {
    if (!gameId || !isSupabaseConfigured) return { error: 'No game.' };
    const { error: err } = await supabase.rpc('pass_turn', { p_game_id: gameId });
    if (err) return { error: err.message };
    return { error: null };
  };

  const announceLastCard = async () => {
    if (!gameId || !isSupabaseConfigured) return;
    const { error: err } = await supabase.rpc('announce_last_card', { p_game_id: gameId });
    warn('announce last card', err);
  };

  const catchLastCard = async (targetPlayerId: string): Promise<{ error: string | null }> => {
    if (!gameId || !isSupabaseConfigured) return { error: 'No game.' };
    const { error: err } = await supabase.rpc('catch_last_card', { p_game_id: gameId, p_target_player_id: targetPlayerId });
    if (err) return { error: err.message };
    return { error: null };
  };

  const leaveGame = async () => {
    if (gameId && isSupabaseConfigured) {
      const { error: err } = await supabase.rpc('leave_cards_game', { p_game_id: gameId });
      warn('leave cards game', err);
    }
    setGameId(null);
    setGame(null);
    setPlayers([]);
    setMyHand([]);
    setResult(null);
    setError(null);
  };

  const myPlayerId = players.find((p) => p.userId === userId)?.id ?? null;

  const value: CardsGameContextValue = {
    game,
    players,
    myHand,
    result,
    myPlayerId,
    loading,
    error,
    createGame,
    joinGame,
    startGame,
    playCard,
    drawCard,
    passTurn,
    announceLastCard,
    catchLastCard,
    leaveGame,
  };

  return <CardsGameContext.Provider value={value}>{children}</CardsGameContext.Provider>;
}

export function useCardsGame(): CardsGameContextValue {
  const ctx = useContext(CardsGameContext);
  if (!ctx) throw new Error('useCardsGame must be used within a CardsGameProvider');
  return ctx;
}
