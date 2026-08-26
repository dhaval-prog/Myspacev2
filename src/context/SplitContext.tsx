import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { Balance, ChatMessage, ExpenseShare, LocationShare, Settlement, SplitExpense, SplitGroup, SplitMember } from '../types/split';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { randomRid } from '../utils/expensesFormat';

export type SplitPage = 'home' | 'dashboard' | 'add' | 'items' | 'settle' | 'location' | 'chat' | 'create';

interface GroupRow {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  category: string;
  currency: string;
  split_mode: 'equal' | 'percentage' | 'custom';
  who_can_add: 'anyone' | 'owner';
  remind_settlements: boolean;
  rid: string;
}

interface ExpenseRow {
  id: string;
  group_id: string;
  paid_by: string;
  title: string;
  amount: number;
  category: string;
  split_mode: 'equal' | 'items';
  created_at: string;
}

interface ShareRow {
  expense_id: string;
  user_id: string;
  share_amount: number;
}

interface SettlementRow {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  created_at: string;
}

interface ChatRow {
  id: string;
  group_id: string;
  user_id: string;
  text: string;
  created_at: string;
}

interface LocationRow {
  group_id: string;
  user_id: string;
  lat: number | null;
  lng: number | null;
  place: string;
  shared: boolean;
  updated_at: string;
}

function toGroup(row: GroupRow, userId: string | null): SplitGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    currency: row.currency,
    splitMode: row.split_mode,
    whoCanAdd: row.who_can_add,
    remindSettlements: row.remind_settlements,
    rid: row.rid,
    isOwner: row.owner_id === userId,
  };
}

interface NewGroupInput {
  name: string;
  description: string;
  category: string;
  currency: string;
  splitMode: 'equal' | 'percentage' | 'custom';
  whoCanAdd: 'anyone' | 'owner';
  remindSettlements: boolean;
}

interface NewExpenseInput {
  title: string;
  amount: number;
  category: string;
  paidBy: string;
  shares: ExpenseShare[];
}

interface NewItemizedInput {
  paidBy: string;
  lines: { name: string; amount: number; assignedUserIds: string[] }[];
}

function warn(action: string, error: { message: string } | null) {
  if (error) console.warn(`[split] failed to ${action}:`, error.message);
}

interface SplitContextValue {
  page: SplitPage;
  groups: SplitGroup[];
  focusedGroup: SplitGroup | undefined;
  membersFor: (groupId: string) => SplitMember[];
  expensesFor: (groupId: string) => SplitExpense[];
  settlementsFor: (groupId: string) => Settlement[];
  chatFor: (groupId: string) => ChatMessage[];
  locationsFor: (groupId: string) => LocationShare[];
  /** Net balance of every OTHER member relative to the signed-in account — positive = they owe you. */
  balancesFor: (groupId: string) => Balance[];
  nameFor: (userId: string) => string;

  goHome: () => void;
  /** Back to the focused group's dashboard (from Add/Items/Settle/Location/Chat) — keeps the group focused, unlike goHome. */
  goDashboard: () => void;
  openGroup: (id: string) => void;
  goCreate: () => void;
  goAdd: () => void;
  goItems: () => void;
  goSettle: () => void;
  goLocation: () => void;
  goChat: () => void;

  createGroup: (input: NewGroupInput) => Promise<void>;
  joinGroup: (code: string) => Promise<{ error: string | null }>;
  addExpense: (input: NewExpenseInput) => Promise<void>;
  addItemizedExpense: (input: NewItemizedInput) => Promise<void>;
  settleUp: (toUserId: string, amount: number) => Promise<void>;
  sendChat: (text: string) => Promise<void>;

  locationSharing: boolean;
  toggleLocationSharing: () => Promise<void>;

  addMembersOpen: boolean;
  openAddMembers: () => void;
  closeAddMembers: () => void;
}

const SplitContext = createContext<SplitContextValue | null>(null);

/**
 * State for the whole Split feature: shared expense groups, persisted to
 * Supabase the same way Expenses' budget_cards are — a group is only ever
 * visible to its owner and to accounts that redeemed its join code, enforced
 * by RLS. Debts are tracked pairwise (who owes whom, not just a net total)
 * so Settle Up always names the right person and amount.
 */
export function SplitProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [groupRows, setGroupRows] = useState<GroupRow[]>([]);
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([]);
  const [shareRows, setShareRows] = useState<ShareRow[]>([]);
  const [settlementRows, setSettlementRows] = useState<SettlementRow[]>([]);
  const [chatRows, setChatRows] = useState<ChatRow[]>([]);
  const [locationRows, setLocationRows] = useState<LocationRow[]>([]);
  const [memberRows, setMemberRows] = useState<{ group_id: string; user_id: string }[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});

  const [page, setPage] = useState<SplitPage>('home');
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [locationSharing, setLocationSharing] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId || !isSupabaseConfigured) {
      setGroupRows([]);
      setExpenseRows([]);
      setShareRows([]);
      setSettlementRows([]);
      setMemberRows([]);
      setLocationRows([]);
      return;
    }

    (async () => {
      const [groupsRes, expensesRes, membersRes, settlementsRes, locationsRes] = await Promise.all([
        supabase.from('split_groups').select('*').order('created_at', { ascending: true }),
        supabase.from('split_expenses').select('*').order('created_at', { ascending: false }),
        supabase.from('split_members').select('group_id,user_id'),
        supabase.from('split_settlements').select('*').order('created_at', { ascending: false }),
        supabase.from('split_locations').select('*'),
      ]);
      if (cancelled) return;

      warn('load groups', groupsRes.error);
      warn('load expenses', expensesRes.error);
      warn('load members', membersRes.error);
      warn('load settlements', settlementsRes.error);
      warn('load locations', locationsRes.error);

      const groups = (groupsRes.data as GroupRow[] | null) ?? [];
      setGroupRows(groups);
      const expenses = (expensesRes.data as ExpenseRow[] | null) ?? [];
      setExpenseRows(expenses);
      setMemberRows((membersRes.data as { group_id: string; user_id: string }[] | null) ?? []);
      setSettlementRows((settlementsRes.data as SettlementRow[] | null) ?? []);
      setLocationRows((locationsRes.data as LocationRow[] | null) ?? []);

      if (expenses.length > 0) {
        const sharesRes = await supabase
          .from('split_expense_shares')
          .select('*')
          .in('expense_id', expenses.map((e) => e.id));
        if (cancelled) return;
        warn('load shares', sharesRes.error);
        setShareRows((sharesRes.data as ShareRow[] | null) ?? []);
      } else {
        setShareRows([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Backfill display names for whoever shows up in a group — owner, member,
  // expense payer — fetched lazily as new people show up.
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const ids = new Set<string>();
    for (const g of groupRows) ids.add(g.owner_id);
    for (const m of memberRows) ids.add(m.user_id);
    for (const e of expenseRows) ids.add(e.paid_by);
    const missing = Array.from(ids).filter((id) => !(id in profileNames));
    if (missing.length === 0) return;

    supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', missing)
      .then(({ data, error }) => {
        warn('load profiles', error);
        if (!data) return;
        setProfileNames((prev) => {
          const next = { ...prev };
          for (const row of data as { id: string; full_name: string | null }[]) {
            next[row.id] = row.full_name || 'Member';
          }
          return next;
        });
      });
    // profileNames deliberately excluded — read to find gaps, not to retrigger on every fill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupRows, memberRows, expenseRows, userId]);

  const groups = useMemo(() => groupRows.map((g) => toGroup(g, userId)), [groupRows, userId]);
  const focusedGroup = groups.find((g) => g.id === focusedGroupId);

  const nameFor = (id: string) => {
    if (id === userId) return 'You';
    return profileNames[id] ?? 'Member';
  };

  const membersFor = (groupId: string): SplitMember[] => {
    const group = groupRows.find((g) => g.id === groupId);
    if (!group) return [];
    const ids = new Set<string>([group.owner_id, ...memberRows.filter((m) => m.group_id === groupId).map((m) => m.user_id)]);
    return Array.from(ids).map((id) => ({ userId: id, name: nameFor(id) }));
  };

  const expensesFor = (groupId: string): SplitExpense[] =>
    expenseRows
      .filter((e) => e.group_id === groupId)
      .map((e) => ({
        id: e.id,
        groupId: e.group_id,
        paidBy: e.paid_by,
        title: e.title,
        amount: e.amount,
        category: e.category,
        splitMode: e.split_mode,
        createdAt: e.created_at,
        shares: shareRows.filter((s) => s.expense_id === e.id).map((s) => ({ userId: s.user_id, amount: s.share_amount })),
      }));

  const settlementsFor = (groupId: string): Settlement[] =>
    settlementRows
      .filter((s) => s.group_id === groupId)
      .map((s) => ({ id: s.id, groupId: s.group_id, fromUserId: s.from_user_id, toUserId: s.to_user_id, amount: s.amount, createdAt: s.created_at }));

  const chatFor = (groupId: string): ChatMessage[] =>
    chatRows
      .filter((m) => m.group_id === groupId)
      .map((m) => ({ id: m.id, groupId: m.group_id, userId: m.user_id, text: m.text, createdAt: m.created_at }));

  const locationsFor = (groupId: string): LocationShare[] =>
    locationRows
      .filter((l) => l.group_id === groupId)
      .map((l) => ({ groupId: l.group_id, userId: l.user_id, lat: l.lat, lng: l.lng, place: l.place, shared: l.shared, updatedAt: l.updated_at }));

  /**
   * Pairwise ledger: for every expense, each non-payer owes the payer their
   * share; a settlement pays that down directly. Netting the two directions
   * between the viewer and one other member is what tells Settle Up exactly
   * who to pay and how much — a single aggregate total can't do that once
   * there are three or more people in the mix.
   */
  const balancesFor = (groupId: string): Balance[] => {
    if (!userId) return [];
    const owes = new Map<string, number>(); // key `${from}|${to}` -> amount from owes to
    const bump = (from: string, to: string, amt: number) => {
      if (from === to || amt === 0) return;
      owes.set(`${from}|${to}`, (owes.get(`${from}|${to}`) ?? 0) + amt);
    };

    for (const e of expensesFor(groupId)) {
      for (const share of e.shares) {
        if (share.userId !== e.paidBy) bump(share.userId, e.paidBy, share.amount);
      }
    }
    for (const s of settlementsFor(groupId)) {
      bump(s.toUserId, s.fromUserId, s.amount); // settling reverses the debt
    }

    return membersFor(groupId)
      .filter((m) => m.userId !== userId)
      .map((m) => {
        const theyOweYou = owes.get(`${m.userId}|${userId}`) ?? 0;
        const youOweThem = owes.get(`${userId}|${m.userId}`) ?? 0;
        return { userId: m.userId, name: m.name, net: theyOweYou - youOweThem };
      })
      .filter((b) => Math.abs(b.net) > 0.01);
  };

  const goHome = () => {
    setPage('home');
    setFocusedGroupId(null);
  };
  const openGroup = (id: string) => {
    setFocusedGroupId(id);
    setPage('dashboard');
  };
  const goDashboard = () => setPage('dashboard');
  const goCreate = () => setPage('create');
  const goAdd = () => setPage('add');
  const goItems = () => setPage('items');
  const goSettle = () => setPage('settle');
  const goLocation = () => setPage('location');
  const goChat = () => setPage('chat');

  const createGroup = async (input: NewGroupInput) => {
    if (!input.name.trim()) return;
    const rid = randomRid();

    if (!userId || !isSupabaseConfigured) {
      const id = `local-group-${Date.now()}`;
      setGroupRows((prev) => [
        ...prev,
        {
          id,
          owner_id: userId ?? 'local',
          name: input.name.trim(),
          description: input.description,
          category: input.category,
          currency: input.currency,
          split_mode: input.splitMode,
          who_can_add: input.whoCanAdd,
          remind_settlements: input.remindSettlements,
          rid,
        },
      ]);
      openGroup(id);
      return;
    }

    const { data, error } = await supabase
      .from('split_groups')
      .insert({
        owner_id: userId,
        name: input.name.trim(),
        description: input.description,
        category: input.category,
        currency: input.currency,
        split_mode: input.splitMode,
        who_can_add: input.whoCanAdd,
        remind_settlements: input.remindSettlements,
        rid,
      })
      .select('*')
      .single();
    warn('create group', error);
    if (data) {
      const row = data as GroupRow;
      setGroupRows((prev) => [...prev, row]);
      openGroup(row.id);
    }
  };

  const joinGroup = async (code: string): Promise<{ error: string | null }> => {
    const rid = code.replace(/\D/g, '');
    if (rid.length !== 11) return { error: 'Enter the full 11-digit code.' };
    if (!userId || !isSupabaseConfigured) return { error: 'Not signed in.' };

    const { data, error } = await supabase.rpc('join_split_group', { p_rid: rid });
    if (error) return { error: error.message.includes('Invalid join code') ? 'That code doesn’t match a split.' : error.message };

    const row = data as GroupRow;
    setGroupRows((prev) => (prev.some((g) => g.id === row.id) ? prev : [...prev, row]));
    return { error: null };
  };

  const addExpense = async ({ title, amount, category, paidBy, shares }: NewExpenseInput) => {
    if (!focusedGroup || !title.trim() || amount <= 0 || shares.length === 0) return;
    const groupId = focusedGroup.id;

    if (!userId || !isSupabaseConfigured) {
      const id = `local-expense-${Date.now()}`;
      setExpenseRows((prev) => [
        { id, group_id: groupId, paid_by: paidBy, title: title.trim(), amount, category, split_mode: 'equal', created_at: new Date().toISOString() },
        ...prev,
      ]);
      setShareRows((prev) => [...prev, ...shares.map((s) => ({ expense_id: id, user_id: s.userId, share_amount: s.amount }))]);
      setPage('dashboard');
      return;
    }

    const { data, error } = await supabase
      .from('split_expenses')
      .insert({ group_id: groupId, paid_by: paidBy, title: title.trim(), amount, category, split_mode: 'equal' })
      .select('*')
      .single();
    warn('add expense', error);
    if (!data) return;
    const row = data as ExpenseRow;
    setExpenseRows((prev) => [row, ...prev]);

    const { data: shareData, error: shareError } = await supabase
      .from('split_expense_shares')
      .insert(shares.map((s) => ({ expense_id: row.id, user_id: s.userId, share_amount: s.amount })))
      .select('*');
    warn('add expense shares', shareError);
    if (shareData) setShareRows((prev) => [...prev, ...(shareData as ShareRow[])]);
    setPage('dashboard');
  };

  const addItemizedExpense = async ({ paidBy, lines }: NewItemizedInput) => {
    if (!focusedGroup || lines.length === 0) return;
    const groupId = focusedGroup.id;
    const total = lines.reduce((s, l) => s + l.amount, 0);
    if (total <= 0) return;

    const shareTotals = new Map<string, number>();
    for (const line of lines) {
      if (line.assignedUserIds.length === 0) continue;
      const each = line.amount / line.assignedUserIds.length;
      for (const uid of line.assignedUserIds) shareTotals.set(uid, (shareTotals.get(uid) ?? 0) + each);
    }
    const shares: ExpenseShare[] = Array.from(shareTotals.entries()).map(([userId2, amt]) => ({ userId: userId2, amount: amt }));

    if (!userId || !isSupabaseConfigured) {
      const id = `local-expense-${Date.now()}`;
      setExpenseRows((prev) => [
        { id, group_id: groupId, paid_by: paidBy, title: 'Smart Split', amount: total, category: '', split_mode: 'items', created_at: new Date().toISOString() },
        ...prev,
      ]);
      setShareRows((prev) => [...prev, ...shares.map((s) => ({ expense_id: id, user_id: s.userId, share_amount: s.amount }))]);
      setPage('dashboard');
      return;
    }

    const { data, error } = await supabase
      .from('split_expenses')
      .insert({ group_id: groupId, paid_by: paidBy, title: 'Smart Split', amount: total, category: '', split_mode: 'items' })
      .select('*')
      .single();
    warn('add itemized expense', error);
    if (!data) return;
    const row = data as ExpenseRow;
    setExpenseRows((prev) => [row, ...prev]);

    const { data: shareData, error: shareError } = await supabase
      .from('split_expense_shares')
      .insert(shares.map((s) => ({ expense_id: row.id, user_id: s.userId, share_amount: s.amount })))
      .select('*');
    warn('add itemized shares', shareError);
    if (shareData) setShareRows((prev) => [...prev, ...(shareData as ShareRow[])]);
    setPage('dashboard');
  };

  const settleUp = async (toUserId: string, amount: number) => {
    if (!focusedGroup || !userId || amount <= 0) return;
    const groupId = focusedGroup.id;

    if (!isSupabaseConfigured) {
      setSettlementRows((prev) => [
        { id: `local-settle-${Date.now()}`, group_id: groupId, from_user_id: userId, to_user_id: toUserId, amount, created_at: new Date().toISOString() },
        ...prev,
      ]);
      return;
    }

    const { data, error } = await supabase
      .from('split_settlements')
      .insert({ group_id: groupId, from_user_id: userId, to_user_id: toUserId, amount })
      .select('*')
      .single();
    warn('settle up', error);
    if (data) setSettlementRows((prev) => [data as SettlementRow, ...prev]);
  };

  const sendChat = async (text: string) => {
    if (!focusedGroup || !text.trim()) return;
    const groupId = focusedGroup.id;

    if (!userId || !isSupabaseConfigured) {
      setChatRows((prev) => [
        ...prev,
        { id: `local-chat-${Date.now()}`, group_id: groupId, user_id: userId ?? 'local', text: text.trim(), created_at: new Date().toISOString() },
      ]);
      return;
    }

    const { error } = await supabase.from('split_chat_messages').insert({ group_id: groupId, user_id: userId, text: text.trim() });
    warn('send chat', error);
    // The row itself arrives back through the Realtime subscription below.
  };

  // Load + subscribe to chat for the focused group only, so we're not
  // holding every group's message history in memory at once.
  useEffect(() => {
    if (!focusedGroupId || !userId || !isSupabaseConfigured) {
      setChatRows([]);
      return;
    }
    let cancelled = false;
    supabase
      .from('split_chat_messages')
      .select('*')
      .eq('group_id', focusedGroupId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        warn('load chat', error);
        if (!cancelled) setChatRows((data as ChatRow[] | null) ?? []);
      });

    const channel = supabase
      .channel(`split-chat-${focusedGroupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'split_chat_messages', filter: `group_id=eq.${focusedGroupId}` },
        (payload) => {
          const row = payload.new as ChatRow;
          setChatRows((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [focusedGroupId, userId]);

  const toggleLocationSharing = async () => {
    if (!focusedGroup || !userId) return;
    const groupId = focusedGroup.id;
    const next = !locationSharing;
    setLocationSharing(next);

    if (!next) {
      watchRef.current?.remove();
      watchRef.current = null;
      if (isSupabaseConfigured) {
        await supabase.from('split_locations').upsert({ group_id: groupId, user_id: userId, shared: false });
      }
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationSharing(false);
      return;
    }

    const upload = async (lat: number, lng: number) => {
      if (isSupabaseConfigured) {
        await supabase.from('split_locations').upsert({ group_id: groupId, user_id: userId, lat, lng, shared: true, updated_at: new Date().toISOString() });
      }
      setLocationRows((prev) => {
        const rest = prev.filter((r) => !(r.group_id === groupId && r.user_id === userId));
        return [...rest, { group_id: groupId, user_id: userId, lat, lng, place: '', shared: true, updated_at: new Date().toISOString() }];
      });
    };

    const current = await Location.getCurrentPositionAsync({});
    await upload(current.coords.latitude, current.coords.longitude);

    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.LocationAccuracy.Balanced, timeInterval: 20000, distanceInterval: 25 },
      (pos) => upload(pos.coords.latitude, pos.coords.longitude),
    );
  };

  useEffect(() => () => watchRef.current?.remove(), []);

  const value: SplitContextValue = {
    page,
    groups,
    focusedGroup,
    membersFor,
    expensesFor,
    settlementsFor,
    chatFor,
    locationsFor,
    balancesFor,
    nameFor,
    goHome,
    goDashboard,
    openGroup,
    goCreate,
    goAdd,
    goItems,
    goSettle,
    goLocation,
    goChat,
    createGroup,
    joinGroup,
    addExpense,
    addItemizedExpense,
    settleUp,
    sendChat,
    locationSharing,
    toggleLocationSharing,
    addMembersOpen,
    openAddMembers: () => setAddMembersOpen(true),
    closeAddMembers: () => setAddMembersOpen(false),
  };

  return <SplitContext.Provider value={value}>{children}</SplitContext.Provider>;
}

export function useSplit(): SplitContextValue {
  const ctx = useContext(SplitContext);
  if (!ctx) throw new Error('useSplit must be used within a SplitProvider');
  return ctx;
}
