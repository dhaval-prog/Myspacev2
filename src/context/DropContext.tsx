import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useFriends } from './FriendsContext';
import type {
  DropAnswer,
  DropPair,
  DropPartnerPerson,
  DropPrompt,
  DropReaction,
  LoveMapLearning,
  Mood,
  MoodCheckState,
  RefocusOutcome,
  RefocusSessionRow,
  RepairCheckin,
  RepairVerdict,
  TodayState,
} from '../types/drop';

function warn(action: string, error: { message: string } | null) {
  if (error) console.warn(`[drop] failed to ${action}:`, error.message);
}

function initialOf(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

function toPerson(row: ProfileRow | undefined, fallbackId: string): DropPartnerPerson {
  const name = row?.full_name || row?.username || 'Someone';
  return { userId: row?.id ?? fallbackId, name, avatarUrl: row?.avatar_url ?? null, initial: initialOf(name) };
}

interface PairRow {
  id: string;
  user_a: string | null;
  user_b: string | null;
  status: 'pending' | 'active' | 'dissolved';
  tz: string;
  together_since: string | null;
  streak: number;
  longest_streak: number;
  freezes_remaining: number;
  last_played_on: string | null;
}

interface DropContextValue {
  loading: boolean;
  pair: DropPair | null;
  incomingProposals: DropPair[];
  outgoingProposal: DropPair | null;
  eligibleFriends: { userId: string; name: string; avatarUrl: string | null }[];
  proposePartner: (friendUserId: string) => Promise<{ error: string | null }>;
  acceptProposal: (pairId: string) => Promise<{ error: string | null }>;
  declineProposal: (pairId: string) => Promise<{ error: string | null }>;
  unpair: () => Promise<{ error: string | null }>;

  todayState: TodayState | null;
  todayPrompts: DropPrompt[];
  myAnswers: Record<string, { pick: number; hunch: number }>;
  partnerAnswers: Record<string, { pick: number; hunch: number }>;
  submitAnswers: (answers: { promptId: string; pick: number; hunch: number }[]) => Promise<{ error: string | null; wavePct?: number }>;
  openYesterdayCatchUp: () => Promise<{ error: string | null }>;

  reactionsByPrompt: Record<string, { mine: string | null; partner: string | null }>;
  react: (promptId: string, emoji: string) => Promise<void>;

  loveMap: LoveMapLearning[];
  addLearning: (about: string, emoji: string, need: string, detail: string, source: 'drop' | 'refocus', origin: string) => Promise<void>;
  addPrivateLearning: (detail: string) => Promise<void>;

  mood: MoodCheckState;
  submitMoodCheck: (mood: Mood) => Promise<{ refocusOffered: boolean } | null>;

  repairCheckin: RepairCheckin;
  startRepairCheckin: () => Promise<void>;
  submitRepairVerdict: (verdict: RepairVerdict) => Promise<void>;
  refreshRepairCheckin: () => Promise<void>;

  refocusHistory: RefocusSessionRow[];
  callRefocusRead: (userText: string, pastedChat?: string) => Promise<RefocusOutcome | null>;
  transcribeScreenshot: (base64: string, mediaType: string) => Promise<{ who: 'me' | 'them'; text: string }[] | null>;
  persistRefocus: (topic: string, sideText: string, aiResult: RefocusOutcome) => Promise<void>;
}

const DropContext = createContext<DropContextValue | null>(null);

export function DropProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { friends } = useFriends();
  const userId = user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [pairRows, setPairRows] = useState<PairRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});

  const [todayState, setTodayState] = useState<TodayState | null>(null);
  const [todayPrompts, setTodayPrompts] = useState<DropPrompt[]>([]);
  const [answerRows, setAnswerRows] = useState<DropAnswer[]>([]);
  const [reactionRows, setReactionRows] = useState<DropReaction[]>([]);
  const [loveMap, setLoveMap] = useState<LoveMapLearning[]>([]);
  const [mood, setMood] = useState<MoodCheckState>({ myMood: null, partnerMood: null, refocusOffered: false });
  const [repairCheckin, setRepairCheckin] = useState<RepairCheckin>({ exists: false });
  const [refocusHistory, setRefocusHistory] = useState<RefocusSessionRow[]>([]);

  const activePair = useMemo(() => pairRows.find((p) => p.status === 'active') ?? null, [pairRows]);
  const incomingRows = useMemo(() => pairRows.filter((p) => p.status === 'pending' && p.user_b === userId), [pairRows, userId]);
  const outgoingRow = useMemo(() => pairRows.find((p) => p.status === 'pending' && p.user_a === userId) ?? null, [pairRows, userId]);

  const otherUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of pairRows) {
      if (p.user_a && p.user_a !== userId) ids.add(p.user_a);
      if (p.user_b && p.user_b !== userId) ids.add(p.user_b);
    }
    return Array.from(ids);
  }, [pairRows, userId]);

  // ---- Load + subscribe to pair rows ----
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function loadPairs() {
      const { data, error } = await supabase
        .from('drop_partners')
        .select('*')
        .or(`user_a.eq.${userId},user_b.eq.${userId}`)
        .neq('status', 'dissolved');
      if (cancelled) return;
      warn('load drop_partners', error);
      setPairRows((data as PairRow[] | null) ?? []);
      setLoading(false);
    }
    loadPairs();

    const poll = setInterval(loadPairs, 6000);
    const channel = supabase
      .channel(`drop-partners-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drop_partners' }, () => loadPairs())
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // ---- Load profiles for me + every counterpart ----
  useEffect(() => {
    if (!userId) return;
    const ids = Array.from(new Set([userId, ...otherUserIds]));
    if (ids.length === 0) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', ids)
      .then(({ data, error }) => {
        if (cancelled) return;
        warn('load profiles', error);
        const next: Record<string, ProfileRow> = {};
        for (const row of (data as ProfileRow[] | null) ?? []) next[row.id] = row;
        setProfiles((prev) => ({ ...prev, ...next }));
      });
    return () => {
      cancelled = true;
    };
  }, [userId, otherUserIds.join(',')]);

  function toDropPair(row: PairRow): DropPair {
    const meIsA = row.user_a === userId;
    const otherId = meIsA ? row.user_b : row.user_a;
    return {
      id: row.id,
      status: row.status,
      meIsA,
      me: toPerson(userId ? profiles[userId] : undefined, userId ?? ''),
      other: toPerson(otherId ? profiles[otherId] : undefined, otherId ?? ''),
      tz: row.tz,
      togetherSince: row.together_since,
      streak: row.streak,
      longestStreak: row.longest_streak,
      freezesRemaining: row.freezes_remaining,
      lastPlayedOn: row.last_played_on,
    };
  }

  const pair = activePair ? toDropPair(activePair) : null;
  const incomingProposals = incomingRows.map(toDropPair);
  const outgoingProposal = outgoingRow ? toDropPair(outgoingRow) : null;

  const pairedUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of pairRows) {
      if (p.user_a) ids.add(p.user_a);
      if (p.user_b) ids.add(p.user_b);
    }
    return ids;
  }, [pairRows]);

  const eligibleFriends = useMemo(
    () => friends.filter((f) => !pairedUserIds.has(f.userId)).map((f) => ({ userId: f.userId, name: f.name, avatarUrl: f.avatarUrl })),
    [friends, pairedUserIds],
  );

  const proposePartner = useCallback(async (friendUserId: string) => {
    const { error } = await supabase.rpc('propose_drop_partner', { p_friend_user_id: friendUserId });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const acceptProposal = useCallback(async (pairId: string) => {
    const { error } = await supabase.rpc('accept_drop_partner', { p_pair_id: pairId });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const declineProposal = useCallback(async (pairId: string) => {
    const { error } = await supabase.rpc('decline_drop_partner', { p_pair_id: pairId });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const unpair = useCallback(async () => {
    if (!pair) return { error: 'no active pair' };
    const { error } = await supabase.rpc('unpair_drop_partner', { p_pair_id: pair.id });
    if (error) return { error: error.message };
    return { error: null };
  }, [pair]);

  // ---- Today's drop state ----
  const refreshTodayState = useCallback(async () => {
    if (!pair) return;
    try {
      const { error: ensureError } = await supabase.rpc('ensure_today_drop', { p_pair: pair.id });
      warn('ensure_today_drop', ensureError);
      const { data, error } = await supabase.rpc('get_today_state', { p_pair: pair.id });
      warn('get_today_state', error);
      if (!data) return;
      const d = data as Record<string, unknown>;
      setTodayState({
        exists: !!d.exists,
        date: String(d.date ?? ''),
        dropDayId: d.drop_day_id as string | undefined,
        state: d.state as TodayState['state'],
        wavePct: d.wave_pct as number | null | undefined,
        iAnswered: d.i_answered as boolean | undefined,
        partnerAnswered: d.partner_answered as boolean | undefined,
        held: !!d.held,
        catchUpAvailable: !!d.catch_up_available,
        yesterdayState: d.yesterday_state as TodayState['yesterdayState'],
        dropCode: d.drop_code as string | null | undefined,
        dropTitle: d.drop_title as string | null | undefined,
      });
    } catch (e) {
      warn('refreshTodayState', { message: e instanceof Error ? e.message : String(e) });
    }
  }, [pair]);

  useEffect(() => {
    if (!pair) {
      setTodayState(null);
      setTodayPrompts([]);
      setAnswerRows([]);
      return;
    }
    refreshTodayState();
    const poll = setInterval(refreshTodayState, 4000);
    const channel = supabase
      .channel(`drop-day-${pair.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drop_days', filter: `pair_id=eq.${pair.id}` }, () => refreshTodayState())
      .subscribe();
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [pair?.id, refreshTodayState]);

  useEffect(() => {
    const dropDayId = todayState?.dropDayId;
    if (!dropDayId || !todayState?.state) return;
    let cancelled = false;

    async function loadDropDayData() {
      const [promptsRes, answersRes, reactionsRes] = await Promise.all([
        supabase.from('drop_days').select('drop_id').eq('id', dropDayId).maybeSingle(),
        supabase.from('drop_answers').select('prompt_id, author, pick, hunch').eq('drop_day_id', dropDayId),
        supabase.from('drop_reactions').select('prompt_id, author, emoji').eq('drop_day_id', dropDayId),
      ]);
      if (cancelled) return;
      warn('load drop day data', promptsRes.error || answersRes.error || reactionsRes.error);

      if (promptsRes.data?.drop_id) {
        const { data: promptRows } = await supabase
          .from('drop_catalog_prompts')
          .select('id, position, emoji, question, options')
          .eq('drop_id', promptsRes.data.drop_id)
          .order('position', { ascending: true });
        if (!cancelled) {
          setTodayPrompts(
            ((promptRows as { id: string; position: number; emoji: string | null; question: string; options: string[] }[] | null) ?? []).map((r) => ({
              id: r.id,
              position: r.position,
              emoji: r.emoji,
              question: r.question,
              options: r.options,
            })),
          );
        }
      }

      setAnswerRows(
        ((answersRes.data as { prompt_id: string; author: string; pick: number; hunch: number }[] | null) ?? []).map((r) => ({
          promptId: r.prompt_id,
          author: r.author,
          pick: r.pick,
          hunch: r.hunch,
        })),
      );
      setReactionRows(
        ((reactionsRes.data as { prompt_id: string; author: string; emoji: string }[] | null) ?? []).map((r) => ({
          promptId: r.prompt_id,
          author: r.author,
          emoji: r.emoji,
        })),
      );
    }
    loadDropDayData();

    const channel = supabase
      .channel(`drop-answers-${dropDayId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drop_answers', filter: `drop_day_id=eq.${dropDayId}` }, () => loadDropDayData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drop_reactions', filter: `drop_day_id=eq.${dropDayId}` }, () => loadDropDayData())
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [todayState?.dropDayId, todayState?.state]);

  const myAnswers = useMemo(() => {
    const map: Record<string, { pick: number; hunch: number }> = {};
    for (const a of answerRows) if (a.author === userId) map[a.promptId] = { pick: a.pick, hunch: a.hunch };
    return map;
  }, [answerRows, userId]);

  const partnerAnswers = useMemo(() => {
    const map: Record<string, { pick: number; hunch: number }> = {};
    for (const a of answerRows) if (a.author !== userId) map[a.promptId] = { pick: a.pick, hunch: a.hunch };
    return map;
  }, [answerRows, userId]);

  const reactionsByPrompt = useMemo(() => {
    const map: Record<string, { mine: string | null; partner: string | null }> = {};
    for (const r of reactionRows) {
      const entry = map[r.promptId] ?? { mine: null, partner: null };
      if (r.author === userId) entry.mine = r.emoji;
      else entry.partner = r.emoji;
      map[r.promptId] = entry;
    }
    return map;
  }, [reactionRows, userId]);

  const submitAnswers = useCallback(
    async (answers: { promptId: string; pick: number; hunch: number }[]) => {
      if (!todayState?.dropDayId) return { error: 'no drop day' };
      const { data, error } = await supabase.rpc('submit_answers', {
        p_drop_day: todayState.dropDayId,
        p_answers: answers.map((a) => ({ prompt_id: a.promptId, pick: a.pick, hunch: a.hunch })),
      });
      if (error) return { error: error.message };
      await refreshTodayState();
      const result = data as Record<string, unknown> | null;
      return { error: null, wavePct: result?.wave_pct as number | undefined };
    },
    [todayState?.dropDayId, refreshTodayState],
  );

  const openYesterdayCatchUp = useCallback(async () => {
    if (!pair) return { error: 'no pair' };
    const { data, error } = await supabase.rpc('ensure_yesterday_drop', { p_pair: pair.id });
    if (error) return { error: error.message };
    const dropDayId = data as string;
    const { data: stateData } = await supabase.rpc('get_today_state', { p_pair: pair.id });
    // ensure_yesterday_drop doesn't change "today" -- surface yesterday's day directly via its id.
    const { data: dayRow } = await supabase.from('drop_days').select('drop_id').eq('id', dropDayId).maybeSingle();
    if (dayRow?.drop_id) {
      const { data: promptRows } = await supabase
        .from('drop_catalog_prompts')
        .select('id, position, emoji, question, options')
        .eq('drop_id', dayRow.drop_id)
        .order('position', { ascending: true });
      setTodayPrompts(
        ((promptRows as { id: string; position: number; emoji: string | null; question: string; options: string[] }[] | null) ?? []).map((r) => ({
          id: r.id,
          position: r.position,
          emoji: r.emoji,
          question: r.question,
          options: r.options,
        })),
      );
    }
    setTodayState((prev) => (prev ? { ...prev, dropDayId, state: 'open' } : prev));
    void stateData;
    return { error: null };
  }, [pair]);

  const react = useCallback(
    async (promptId: string, emoji: string) => {
      if (!todayState?.dropDayId || !userId) return;
      setReactionRows((prev) => {
        const filtered = prev.filter((r) => !(r.promptId === promptId && r.author === userId));
        return [...filtered, { promptId, author: userId, emoji }];
      });
      const { error } = await supabase
        .from('drop_reactions')
        .upsert({ drop_day_id: todayState.dropDayId, prompt_id: promptId, author: userId, emoji }, { onConflict: 'drop_day_id,prompt_id,author' });
      warn('react', error);
    },
    [todayState?.dropDayId, userId],
  );

  // ---- Love map ----
  useEffect(() => {
    if (!pair) {
      setLoveMap([]);
      return;
    }
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from('love_map_learnings')
        .select('*')
        .eq('pair_id', pair!.id)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      warn('load love_map_learnings', error);
      setLoveMap(
        ((data as { id: string; about: string; author_id: string | null; emoji: string | null; need: string; detail: string | null; source: string; became_prompt_id: string | null; created_at: string }[] | null) ?? []).map(
          (r) => ({
            id: r.id,
            about: r.about,
            authorId: r.author_id,
            emoji: r.emoji,
            need: r.need,
            detail: r.detail,
            source: r.source as LoveMapLearning['source'],
            becamePromptId: r.became_prompt_id,
            createdAt: r.created_at,
          }),
        ),
      );
    }
    load();
    const channel = supabase
      .channel(`drop-love-map-${pair.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'love_map_learnings', filter: `pair_id=eq.${pair.id}` }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [pair?.id]);

  const addLearning = useCallback(
    async (about: string, emoji: string, need: string, detail: string, source: 'drop' | 'refocus', origin: string) => {
      if (!pair) return;
      const { error } = await supabase.rpc('add_learning', { p_pair: pair.id, p_about: about, p_emoji: emoji, p_need: need, p_detail: detail, p_source: source, p_origin: origin });
      warn('add_learning', error);
    },
    [pair],
  );

  const addPrivateLearning = useCallback(
    async (detail: string) => {
      if (!pair || !detail.trim()) return;
      const { error } = await supabase.rpc('add_private_learning', { p_pair: pair.id, p_learning_detail: detail.trim() });
      warn('add_private_learning', error);
    },
    [pair],
  );

  // ---- Mood ----
  useEffect(() => {
    if (!pair || !userId) {
      setMood({ myMood: null, partnerMood: null, refocusOffered: false });
      return;
    }
    let cancelled = false;
    async function load() {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase.from('mood_checks').select('user_id, mood, refocus_offered').eq('pair_id', pair!.id).eq('pair_local_date', today);
      if (cancelled) return;
      warn('load mood_checks', error);
      const rows = (data as { user_id: string; mood: Mood; refocus_offered: boolean }[] | null) ?? [];
      const mine = rows.find((r) => r.user_id === userId);
      const partner = rows.find((r) => r.user_id !== userId);
      setMood({ myMood: mine?.mood ?? null, partnerMood: partner?.mood ?? null, refocusOffered: mine?.refocus_offered ?? false });
    }
    load();
    const channel = supabase
      .channel(`drop-mood-${pair.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mood_checks', filter: `pair_id=eq.${pair.id}` }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [pair?.id, userId]);

  const submitMoodCheck = useCallback(
    async (nextMood: Mood) => {
      if (!pair) return null;
      const { data, error } = await supabase.rpc('submit_mood_check', { p_pair: pair.id, p_mood: nextMood });
      if (error) {
        warn('submit_mood_check', error);
        return null;
      }
      const result = data as { mood: Mood; refocus_offered: boolean } | null;
      setMood((prev) => ({ ...prev, myMood: nextMood, refocusOffered: result?.refocus_offered ?? prev.refocusOffered }));
      return result ? { refocusOffered: result.refocus_offered } : null;
    },
    [pair],
  );

  // ---- Repair check-in ----
  const refreshRepairCheckin = useCallback(async () => {
    if (!pair) {
      setRepairCheckin({ exists: false });
      return;
    }
    const { data, error } = await supabase.rpc('get_repair_checkin', { p_pair: pair.id });
    warn('get_repair_checkin', error);
    const d = (data as Record<string, unknown>) ?? {};
    setRepairCheckin({
      exists: !!d.exists,
      id: d.id as string | undefined,
      state: d.state as RepairCheckin['state'],
      iAnswered: d.i_answered as boolean | undefined,
      partnerAnswered: d.partner_answered as boolean | undefined,
      myVerdict: d.my_verdict as RepairVerdict | null | undefined,
      theirVerdict: d.their_verdict as RepairVerdict | null | undefined,
      reflectionMine: d.reflection_mine as boolean | undefined,
    });
  }, [pair]);

  useEffect(() => {
    refreshRepairCheckin();
    if (!pair) return;
    const channel = supabase
      .channel(`drop-repair-${pair.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repair_checkins', filter: `pair_id=eq.${pair.id}` }, () => refreshRepairCheckin())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [pair?.id, refreshRepairCheckin]);

  const startRepairCheckin = useCallback(async () => {
    if (!pair) return;
    const { error } = await supabase.rpc('start_repair_checkin', { p_pair: pair.id });
    warn('start_repair_checkin', error);
    await refreshRepairCheckin();
  }, [pair, refreshRepairCheckin]);

  const submitRepairVerdict = useCallback(
    async (verdict: RepairVerdict) => {
      if (!repairCheckin.id) return;
      const { error } = await supabase.rpc('submit_repair_verdict', { p_checkin: repairCheckin.id, p_verdict: verdict });
      warn('submit_repair_verdict', error);
      await refreshRepairCheckin();
    },
    [repairCheckin.id, refreshRepairCheckin],
  );

  // ---- Refocus ----
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase.from('refocus_sessions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
      if (cancelled) return;
      warn('load refocus_sessions', error);
      setRefocusHistory(
        ((data as { id: string; topic: string | null; side_text: string; ai_result: unknown; created_at: string }[] | null) ?? []).map((r) => ({
          id: r.id,
          topic: r.topic,
          sideText: r.side_text,
          aiResult: r.ai_result as RefocusSessionRow['aiResult'],
          createdAt: r.created_at,
        })),
      );
    }
    load();
    const channel = supabase
      .channel(`drop-refocus-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'refocus_sessions', filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const callRefocusRead = useCallback(async (userText: string, pastedChat?: string): Promise<RefocusOutcome | null> => {
    const { data, error } = await supabase.functions.invoke('refocus', { body: { schema: 'v2', userText, pastedChat } });
    if (error || !data) {
      warn('refocus v2', error as { message: string } | null);
      return null;
    }
    if (data.read) return { read: data.read };
    if (data.safety) return { safety: data.safety };
    return null;
  }, []);

  const transcribeScreenshot = useCallback(async (base64: string, mediaType: string) => {
    const { data, error } = await supabase.functions.invoke('refocus', { body: { schema: 'transcribe', imageBase64: base64, mediaType } });
    if (error || !data?.lines) {
      warn('refocus transcribe', error as { message: string } | null);
      return null;
    }
    return data.lines as { who: 'me' | 'them'; text: string }[];
  }, []);

  const persistRefocus = useCallback(
    async (topic: string, sideText: string, aiResult: RefocusOutcome) => {
      const { error } = await supabase.rpc('save_solo_refocus', {
        p_pair: pair?.id ?? null,
        p_topic: topic,
        p_side: sideText,
        p_ai_result: aiResult,
      });
      warn('save_solo_refocus', error);
    },
    [pair],
  );

  const value: DropContextValue = {
    loading,
    pair,
    incomingProposals,
    outgoingProposal,
    eligibleFriends,
    proposePartner,
    acceptProposal,
    declineProposal,
    unpair,

    todayState,
    todayPrompts,
    myAnswers,
    partnerAnswers,
    submitAnswers,
    openYesterdayCatchUp,

    reactionsByPrompt,
    react,

    loveMap,
    addLearning,
    addPrivateLearning,

    mood,
    submitMoodCheck,

    repairCheckin,
    startRepairCheckin,
    submitRepairVerdict,
    refreshRepairCheckin,

    refocusHistory,
    callRefocusRead,
    transcribeScreenshot,
    persistRefocus,
  };

  return <DropContext.Provider value={value}>{children}</DropContext.Provider>;
}

export function useDrop(): DropContextValue {
  const ctx = useContext(DropContext);
  if (!ctx) throw new Error('useDrop must be used within a DropProvider');
  return ctx;
}
