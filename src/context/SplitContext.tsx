import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Balance, ChatMessage, ExpenseShare, Settlement, SplitExpense, SplitGroup, SplitMember } from '../types/split';
import type { PaymentAttempt, PaymentAttemptStatus, UpiProfile } from '../types/payments';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { randomRid } from '../utils/expensesFormat';

export type SplitPage = 'home' | 'dashboard' | 'add' | 'items' | 'settle' | 'chat' | 'create' | 'pay-confirm' | 'pay-status';

interface GroupRow {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  category: string;
  currency: string;
  split_mode: 'equal' | 'percentage' | 'custom' | 'shares';
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
  source: 'manual' | 'upi';
  payment_attempt_id: string | null;
}

interface ChatRow {
  id: string;
  group_id: string;
  user_id: string;
  text: string;
  created_at: string;
}

interface PaymentAttemptRow {
  id: string;
  reference: string;
  split_id: string;
  payer_user_id: string;
  recipient_user_id: string;
  recipient_upi_id: string;
  amount: number;
  currency: string;
  status: PaymentAttemptStatus;
  provider: string;
  upi_app: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
}

interface PaymentProfileRow {
  user_id: string;
  upi_id: string | null;
  upi_verified: boolean;
}

function toPaymentAttempt(row: PaymentAttemptRow): PaymentAttempt {
  return {
    id: row.id,
    reference: row.reference,
    splitId: row.split_id,
    payerUserId: row.payer_user_id,
    recipientUserId: row.recipient_user_id,
    recipientUpiId: row.recipient_upi_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    provider: row.provider,
    upiApp: row.upi_app,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    verifiedAt: row.verified_at,
  };
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

export interface NewGroupInput {
  name: string;
  description: string;
  category: string;
  currency: string;
  splitMode: 'equal' | 'percentage' | 'custom' | 'shares';
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

function warn(action: string, error: { message: string } | null) {
  if (error) console.warn(`[split] failed to ${action}:`, error.message);
}

interface SplitContextValue {
  loading: boolean;
  refreshing: boolean;
  refresh: () => void;
  page: SplitPage;
  groups: SplitGroup[];
  focusedGroup: SplitGroup | undefined;
  membersFor: (groupId: string) => SplitMember[];
  expensesFor: (groupId: string) => SplitExpense[];
  settlementsFor: (groupId: string) => Settlement[];
  chatFor: (groupId: string) => ChatMessage[];
  /** Net balance of every OTHER member relative to the signed-in account — positive = they owe you. */
  balancesFor: (groupId: string) => Balance[];
  nameFor: (userId: string) => string;
  /** UPI receiving profile for a member, if loaded — undefined means "not fetched yet", not "has none". */
  upiProfileFor: (userId: string) => UpiProfile | undefined;
  /** This user's own UPI payment attempts (as payer or recipient) for one split. */
  paymentAttemptsFor: (groupId: string) => PaymentAttempt[];
  /** The payment attempt currently focused by the pay-status screen, if any. */
  focusedPaymentAttempt: PaymentAttempt | undefined;
  /** Staged recipient/amount for the pay-confirm screen, set by goPayConfirm before an attempt exists. */
  pendingPayment: { recipientUserId: string; amount: number } | null;

  goHome: () => void;
  /** Back to the focused group's dashboard (from Add/Items/Settle/Chat) — keeps the group focused, unlike goHome. */
  goDashboard: () => void;
  openGroup: (id: string) => void;
  goCreate: () => void;
  goAdd: () => void;
  goItems: () => void;
  goSettle: () => void;
  goChat: () => void;
  /** Stages a recipient + amount and opens the "Pay ₹X" confirmation screen — no attempt is created yet. */
  goPayConfirm: (recipientUserId: string, amount: number) => void;
  /** Opens the payment status screen for an existing attempt (freshly created, or re-opened from history). */
  goPayStatus: (attemptId: string) => void;

  createGroup: (input: NewGroupInput) => Promise<SplitGroup | null>;
  updateGroup: (id: string, input: NewGroupInput) => Promise<void>;
  joinGroup: (code: string) => Promise<{ error: string | null }>;
  /** Owner-only: adds someone already known from another split/card directly to this group, no invite code needed. */
  addKnownMember: (groupId: string, userId: string) => Promise<{ error: string | null }>;
  /** Owner-only: permanently deletes the group and everything filed under it (expenses, shares, settlements, chat, members). No-op for non-owners. */
  deleteGroup: (groupId: string) => Promise<void>;
  addExpense: (input: NewExpenseInput) => Promise<void>;
  settleUp: (toUserId: string, amount: number) => Promise<void>;
  sendChat: (text: string) => Promise<void>;

  /** Creates a server-tracked payment attempt for the focused group (validates amount, dedupes in-flight attempts). */
  createUpiPayment: (recipientUserId: string, amount: number) => Promise<{ attempt: PaymentAttempt | null; error: string | null }>;
  /** Payer-only: records that the UPI app was launched — informational, never settles anything on its own. */
  markUpiPaymentSent: (attemptId: string, upiApp?: string) => Promise<{ error: string | null }>;
  /** Recipient-only: the sole action that actually settles a payment — inserts the matching split_settlements row server-side. */
  confirmUpiPayment: (attemptId: string) => Promise<{ error: string | null }>;
  /** Payer-only: gives up on an in-flight attempt so "Try Again" can start a fresh one. */
  cancelUpiPayment: (attemptId: string) => Promise<{ error: string | null }>;
  /** Nudges a co-member who hasn't set up a UPI ID yet. */
  remindUpiSetup: (targetUserId: string) => Promise<{ error: string | null }>;
  /** Re-fetches one attempt from the backend directly — a defensive fallback for the status screen's "Check again", in case a realtime update was missed. */
  refreshPaymentAttempt: (attemptId: string) => Promise<void>;

  addMembersOpen: boolean;
  openAddMembers: () => void;
  closeAddMembers: () => void;

  /** Non-owner only: whether the "leave this split?" confirm is open. */
  confirmLeaveOpen: boolean;
  askLeave: () => void;
  cancelLeave: () => void;
  /** Non-owner only: removes the signed-in account from the focused group and returns home. No-op for owners. */
  leaveGroup: () => void;
}

const SplitContext = createContext<SplitContextValue | null>(null);

/**
 * State for the whole Split feature: shared expense groups, persisted to
 * Supabase the same way Expenses' budget_cards are — a group is only ever
 * visible to its owner and to accounts that redeemed its join code, enforced
 * by RLS. Debts are tracked pairwise (who owes whom, not just a net total)
 * so Settle Up always names the right person and amount.
 */
interface SplitProviderProps {
  children: React.ReactNode;
  /** Opens this group's dashboard as soon as it loads — set when arriving here from a notification about it. */
  initialGroupId?: string;
}

export function SplitProvider({ children, initialGroupId }: SplitProviderProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [groupRows, setGroupRows] = useState<GroupRow[]>([]);
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([]);
  const [shareRows, setShareRows] = useState<ShareRow[]>([]);
  const [settlementRows, setSettlementRows] = useState<SettlementRow[]>([]);
  const [chatRows, setChatRows] = useState<ChatRow[]>([]);
  const [memberRows, setMemberRows] = useState<{ group_id: string; user_id: string }[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [profileAvatars, setProfileAvatars] = useState<Record<string, string | null>>({});
  const [paymentAttemptRows, setPaymentAttemptRows] = useState<PaymentAttemptRow[]>([]);
  const [paymentProfiles, setPaymentProfiles] = useState<Record<string, UpiProfile>>({});

  const [page, setPage] = useState<SplitPage>('home');
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{ recipientUserId: string; amount: number } | null>(null);
  const [focusedPaymentAttemptId, setFocusedPaymentAttemptId] = useState<string | null>(null);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId || !isSupabaseConfigured) {
      setGroupRows([]);
      setExpenseRows([]);
      setShareRows([]);
      setSettlementRows([]);
      setMemberRows([]);
      setPaymentAttemptRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      const [groupsRes, expensesRes, membersRes, settlementsRes, paymentAttemptsRes] = await Promise.all([
        supabase.from('split_groups').select('*').order('created_at', { ascending: true }),
        supabase.from('split_expenses').select('*').order('created_at', { ascending: false }),
        supabase.from('split_members').select('group_id,user_id'),
        supabase.from('split_settlements').select('*').order('created_at', { ascending: false }),
        supabase.from('payment_attempts').select('*').order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;

      warn('load groups', groupsRes.error);
      warn('load expenses', expensesRes.error);
      warn('load members', membersRes.error);
      warn('load settlements', settlementsRes.error);
      warn('load payment attempts', paymentAttemptsRes.error);

      const groups = (groupsRes.data as GroupRow[] | null) ?? [];
      setGroupRows(groups);
      const expenses = (expensesRes.data as ExpenseRow[] | null) ?? [];
      setExpenseRows(expenses);
      setMemberRows((membersRes.data as { group_id: string; user_id: string }[] | null) ?? []);
      setSettlementRows((settlementsRes.data as SettlementRow[] | null) ?? []);
      setPaymentAttemptRows((paymentAttemptsRes.data as PaymentAttemptRow[] | null) ?? []);

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
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refresh = async () => {
    if (!userId || !isSupabaseConfigured) return;
    setRefreshing(true);
    const [groupsRes, expensesRes, membersRes, settlementsRes, paymentAttemptsRes] = await Promise.all([
      supabase.from('split_groups').select('*').order('created_at', { ascending: true }),
      supabase.from('split_expenses').select('*').order('created_at', { ascending: false }),
      supabase.from('split_members').select('group_id,user_id'),
      supabase.from('split_settlements').select('*').order('created_at', { ascending: false }),
      supabase.from('payment_attempts').select('*').order('created_at', { ascending: false }),
    ]);

    warn('refresh groups', groupsRes.error);
    warn('refresh expenses', expensesRes.error);
    warn('refresh members', membersRes.error);
    warn('refresh settlements', settlementsRes.error);
    warn('refresh payment attempts', paymentAttemptsRes.error);

    const groups = (groupsRes.data as GroupRow[] | null) ?? [];
    setGroupRows(groups);
    const expenses = (expensesRes.data as ExpenseRow[] | null) ?? [];
    setExpenseRows(expenses);
    setMemberRows((membersRes.data as { group_id: string; user_id: string }[] | null) ?? []);
    setSettlementRows((settlementsRes.data as SettlementRow[] | null) ?? []);
    setPaymentAttemptRows((paymentAttemptsRes.data as PaymentAttemptRow[] | null) ?? []);

    if (expenses.length > 0) {
      const sharesRes = await supabase
        .from('split_expense_shares')
        .select('*')
        .in('expense_id', expenses.map((e) => e.id));
      warn('refresh shares', sharesRes.error);
      setShareRows((sharesRes.data as ShareRow[] | null) ?? []);
    } else {
      setShareRows([]);
    }
    setRefreshing(false);
  };

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
      .select('id, full_name, avatar_url')
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
        setProfileAvatars((prev) => {
          const next = { ...prev };
          for (const row of data as { id: string; avatar_url: string | null }[]) {
            next[row.id] = row.avatar_url;
          }
          return next;
        });
      });
    // profileNames deliberately excluded — read to find gaps, not to retrigger on every fill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupRows, memberRows, expenseRows, userId]);

  // Same lazy-backfill shape as profileNames above, but for UPI receiving
  // profiles — needed to know whether a member can be paid (and is
  // verified) before showing a "Pay" button for them.
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const ids = new Set<string>();
    for (const g of groupRows) ids.add(g.owner_id);
    for (const m of memberRows) ids.add(m.user_id);
    const missing = Array.from(ids).filter((id) => !(id in paymentProfiles));
    if (missing.length === 0) return;

    supabase
      .from('user_payment_profiles')
      .select('user_id, upi_id, upi_verified')
      .in('user_id', missing)
      .then(({ data, error }) => {
        warn('load payment profiles', error);
        setPaymentProfiles((prev) => {
          const next = { ...prev };
          // Anyone with no row yet still gets an entry, so we don't refetch them forever.
          for (const id of missing) next[id] = prev[id] ?? { userId: id, upiId: null, upiVerified: false };
          for (const row of (data as PaymentProfileRow[] | null) ?? []) {
            next[row.user_id] = { userId: row.user_id, upiId: row.upi_id, upiVerified: row.upi_verified };
          }
          return next;
        });
      });
    // paymentProfiles deliberately excluded — read to find gaps, not to retrigger on every fill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupRows, memberRows, userId]);

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
    return Array.from(ids).map((id) => ({ userId: id, name: nameFor(id), isOwner: id === group.owner_id, avatarUrl: profileAvatars[id] ?? null }));
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
      .map((s) => ({
        id: s.id,
        groupId: s.group_id,
        fromUserId: s.from_user_id,
        toUserId: s.to_user_id,
        amount: s.amount,
        createdAt: s.created_at,
        source: s.source,
        paymentAttemptId: s.payment_attempt_id,
      }));

  const chatFor = (groupId: string): ChatMessage[] =>
    chatRows
      .filter((m) => m.group_id === groupId)
      .map((m) => ({ id: m.id, groupId: m.group_id, userId: m.user_id, text: m.text, createdAt: m.created_at }));

  const upiProfileFor = (id: string): UpiProfile | undefined => paymentProfiles[id];

  const paymentAttemptsFor = (groupId: string): PaymentAttempt[] =>
    paymentAttemptRows.filter((r) => r.split_id === groupId).map(toPaymentAttempt);

  const focusedPaymentAttempt = focusedPaymentAttemptId
    ? (() => {
        const row = paymentAttemptRows.find((r) => r.id === focusedPaymentAttemptId);
        return row ? toPaymentAttempt(row) : undefined;
      })()
    : undefined;

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

  // Arriving here from a notification about a specific group — open it as
  // soon as it shows up in the loaded list, once per target id.
  const lastFocusedGroupIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!initialGroupId || initialGroupId === lastFocusedGroupIdRef.current) return;
    if (!groupRows.some((g) => g.id === initialGroupId)) return;
    lastFocusedGroupIdRef.current = initialGroupId;
    openGroup(initialGroupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGroupId, groupRows]);

  const goDashboard = () => setPage('dashboard');
  const goCreate = () => setPage('create');
  const goAdd = () => setPage('add');
  const goItems = () => setPage('items');
  const goSettle = () => setPage('settle');
  const goChat = () => setPage('chat');
  const goPayConfirm = (recipientUserId: string, amount: number) => {
    setPendingPayment({ recipientUserId, amount });
    setPage('pay-confirm');
  };
  const goPayStatus = (attemptId: string) => {
    setFocusedPaymentAttemptId(attemptId);
    setPage('pay-status');
  };

  /**
   * Creates the group but deliberately does NOT navigate — the create
   * screen needs a real group (and its join code) as soon as the user
   * wants to invite someone, even before they've finished the rest of the
   * form. Callers that mean "create and go" (the final "Create Split" tap)
   * call `openGroup` themselves once this resolves.
   */
  const createGroup = async (input: NewGroupInput): Promise<SplitGroup | null> => {
    if (!input.name.trim()) return null;
    const rid = randomRid();

    if (!userId || !isSupabaseConfigured) {
      const id = `local-group-${Date.now()}`;
      const row: GroupRow = {
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
      };
      setGroupRows((prev) => [...prev, row]);
      return toGroup(row, userId);
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
    if (!data) return null;
    const row = data as GroupRow;
    setGroupRows((prev) => [...prev, row]);
    return toGroup(row, userId);
  };

  /** Finalizes a group's fields — used when the create screen already made a draft group (to get an invite code) before the user finished filling out the rest of the form. */
  const updateGroup = async (id: string, input: NewGroupInput): Promise<void> => {
    if (!input.name.trim()) return;
    setGroupRows((prev) =>
      prev.map((g) =>
        g.id === id
          ? {
              ...g,
              name: input.name.trim(),
              description: input.description,
              category: input.category,
              currency: input.currency,
              split_mode: input.splitMode,
              who_can_add: input.whoCanAdd,
              remind_settlements: input.remindSettlements,
            }
          : g,
      ),
    );
    if (!userId || !isSupabaseConfigured) return;
    const { error } = await supabase
      .from('split_groups')
      .update({
        name: input.name.trim(),
        description: input.description,
        category: input.category,
        currency: input.currency,
        split_mode: input.splitMode,
        who_can_add: input.whoCanAdd,
        remind_settlements: input.remindSettlements,
      })
      .eq('id', id);
    warn('update group', error);
  };

  const joinGroup = async (code: string): Promise<{ error: string | null }> => {
    const rid = code.replace(/\D/g, '');
    if (rid.length !== 11) return { error: 'Enter the full 11-digit code.' };
    if (!userId || !isSupabaseConfigured) return { error: 'Not signed in.' };

    const { data, error } = await supabase.rpc('join_split_group', { p_rid: rid });
    if (error) return { error: error.message.includes('Invalid join code') ? 'That code doesn’t match a split.' : error.message };

    const row = data as GroupRow;
    setGroupRows((prev) => (prev.some((g) => g.id === row.id) ? prev : [...prev, row]));
    setMemberRows((prev) => (prev.some((m) => m.group_id === row.id && m.user_id === userId) ? prev : [...prev, { group_id: row.id, user_id: userId }]));
    return { error: null };
  };

  const addKnownMember = async (groupId: string, targetUserId: string): Promise<{ error: string | null }> => {
    if (!userId || !isSupabaseConfigured) return { error: 'Not signed in.' };
    const { error } = await supabase.rpc('add_split_member', { p_group_id: groupId, p_user_id: targetUserId });
    if (error) return { error: error.message };
    setMemberRows((prev) =>
      prev.some((m) => m.group_id === groupId && m.user_id === targetUserId) ? prev : [...prev, { group_id: groupId, user_id: targetUserId }],
    );
    return { error: null };
  };

  const deleteGroup = async (groupId: string) => {
    const group = groupRows.find((g) => g.id === groupId);
    if (!group || group.owner_id !== userId) return;

    const expenseIds = expenseRows.filter((e) => e.group_id === groupId).map((e) => e.id);

    if (isSupabaseConfigured && userId) {
      if (expenseIds.length > 0) {
        warn('delete expense shares', (await supabase.from('split_expense_shares').delete().in('expense_id', expenseIds)).error);
      }
      warn('delete expenses', (await supabase.from('split_expenses').delete().eq('group_id', groupId)).error);
      warn('delete settlements', (await supabase.from('split_settlements').delete().eq('group_id', groupId)).error);
      warn('delete chat', (await supabase.from('split_chat_messages').delete().eq('group_id', groupId)).error);
      warn('delete members', (await supabase.from('split_members').delete().eq('group_id', groupId)).error);
      warn('delete group', (await supabase.from('split_groups').delete().eq('id', groupId).eq('owner_id', userId)).error);
    }

    const expenseIdSet = new Set(expenseIds);
    setGroupRows((prev) => prev.filter((g) => g.id !== groupId));
    setExpenseRows((prev) => prev.filter((e) => e.group_id !== groupId));
    setShareRows((prev) => prev.filter((s) => !expenseIdSet.has(s.expense_id)));
    setSettlementRows((prev) => prev.filter((s) => s.group_id !== groupId));
    setChatRows((prev) => prev.filter((m) => m.group_id !== groupId));
    setMemberRows((prev) => prev.filter((m) => m.group_id !== groupId));
    if (focusedGroupId === groupId) {
      setFocusedGroupId(null);
      setPage('home');
    }
  };

  /** Strips the group from local state (a leave, not a delete — the group and its data live on for everyone else) and removes only this account's membership row. */
  const leaveGroup = () => {
    if (!focusedGroup || focusedGroup.isOwner) return;
    const groupId = focusedGroup.id;
    const expenseIdSet = new Set(expenseRows.filter((e) => e.group_id === groupId).map((e) => e.id));

    setGroupRows((prev) => prev.filter((g) => g.id !== groupId));
    setExpenseRows((prev) => prev.filter((e) => e.group_id !== groupId));
    setShareRows((prev) => prev.filter((s) => !expenseIdSet.has(s.expense_id)));
    setSettlementRows((prev) => prev.filter((s) => s.group_id !== groupId));
    setChatRows((prev) => prev.filter((m) => m.group_id !== groupId));
    setMemberRows((prev) => prev.filter((m) => m.group_id !== groupId));
    setConfirmLeaveOpen(false);
    setFocusedGroupId(null);
    setPage('home');

    if (userId && isSupabaseConfigured) {
      supabase
        .from('split_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .then(({ error }) => warn('leave group', error));
    }
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

    // Notifies other split members (if any) — no-op server-side when it's a solo split.
    const { error: notifyError } = await supabase.rpc('notify_split_expense_activity', {
      p_group_id: groupId,
      p_expense_title: title.trim(),
      p_amount: amount,
    });
    warn('notify split expense activity', notifyError);
  };

  const settleUp = async (toUserId: string, amount: number) => {
    if (!focusedGroup || !userId || amount <= 0) return;
    const groupId = focusedGroup.id;

    if (!isSupabaseConfigured) {
      setSettlementRows((prev) => [
        {
          id: `local-settle-${Date.now()}`,
          group_id: groupId,
          from_user_id: userId,
          to_user_id: toUserId,
          amount,
          created_at: new Date().toISOString(),
          source: 'manual',
          payment_attempt_id: null,
        },
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

  const createUpiPayment = async (recipientUserId: string, amount: number): Promise<{ attempt: PaymentAttempt | null; error: string | null }> => {
    if (!focusedGroup || !userId || !isSupabaseConfigured) return { attempt: null, error: 'Not signed in.' };
    const { data, error } = await supabase.rpc('create_upi_payment', {
      p_split_id: focusedGroup.id,
      p_recipient_id: recipientUserId,
      p_amount: amount,
    });
    if (error) return { attempt: null, error: error.message };
    const row = data as PaymentAttemptRow;
    setPaymentAttemptRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
    return { attempt: toPaymentAttempt(row), error: null };
  };

  const markUpiPaymentSent = async (attemptId: string, upiApp?: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) return { error: 'Not signed in.' };
    const { data, error } = await supabase.rpc('mark_upi_payment_sent', { p_attempt_id: attemptId, p_upi_app: upiApp ?? null });
    if (error) return { error: error.message };
    if (data) setPaymentAttemptRows((prev) => prev.map((r) => (r.id === attemptId ? (data as PaymentAttemptRow) : r)));
    return { error: null };
  };

  const confirmUpiPayment = async (attemptId: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) return { error: 'Not signed in.' };
    const { data, error } = await supabase.rpc('confirm_upi_payment', { p_attempt_id: attemptId });
    if (error) return { error: error.message };
    if (data) setPaymentAttemptRows((prev) => prev.map((r) => (r.id === attemptId ? (data as PaymentAttemptRow) : r)));
    return { error: null };
  };

  const cancelUpiPayment = async (attemptId: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) return { error: 'Not signed in.' };
    const { data, error } = await supabase.rpc('cancel_upi_payment', { p_attempt_id: attemptId });
    if (error) return { error: error.message };
    if (data) setPaymentAttemptRows((prev) => prev.map((r) => (r.id === attemptId ? (data as PaymentAttemptRow) : r)));
    return { error: null };
  };

  const remindUpiSetup = async (targetUserId: string): Promise<{ error: string | null }> => {
    if (!focusedGroup || !isSupabaseConfigured) return { error: 'Not signed in.' };
    const { error } = await supabase.rpc('remind_upi_setup', { p_user_id: targetUserId, p_split_id: focusedGroup.id });
    return { error: error ? error.message : null };
  };

  const refreshPaymentAttempt = async (attemptId: string): Promise<void> => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.from('payment_attempts').select('*').eq('id', attemptId).maybeSingle();
    warn('refresh payment attempt', error);
    if (data) setPaymentAttemptRows((prev) => [data as PaymentAttemptRow, ...prev.filter((r) => r.id !== attemptId)]);
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

  // Re-fetch + subscribe to membership for the focused group only — the
  // initial load effect only fetches members once at sign-in, so without
  // this, a member who joins via invite code while someone else already
  // has the dashboard open (or the joiner's own first visit) would show
  // a stale, undercounted People list until a full app reload.
  useEffect(() => {
    if (!focusedGroupId || !userId || !isSupabaseConfigured) return;
    let cancelled = false;
    supabase
      .from('split_members')
      .select('group_id,user_id')
      .eq('group_id', focusedGroupId)
      .then(({ data, error }) => {
        warn('load members', error);
        if (cancelled || !data) return;
        setMemberRows((prev) => [...prev.filter((m) => m.group_id !== focusedGroupId), ...(data as { group_id: string; user_id: string }[])]);
      });

    const channel = supabase
      .channel(`split-members-${focusedGroupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'split_members', filter: `group_id=eq.${focusedGroupId}` },
        (payload) => {
          const row = payload.new as { group_id: string; user_id: string };
          setMemberRows((prev) => (prev.some((m) => m.group_id === row.group_id && m.user_id === row.user_id) ? prev : [...prev, row]));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [focusedGroupId, userId]);

  // Settlements and payment attempts are both loaded eagerly for every
  // group up front (unlike chat/members, which are per-focused-group), so
  // their realtime subscriptions stay unscoped too — RLS already limits
  // what actually arrives (settlements: any split member; attempts: payer
  // or recipient only). This is what makes balances update live for
  // everyone in a group the instant `confirm_upi_payment` settles one.
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const channel = supabase
      .channel('split-settlements-all')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'split_settlements' }, (payload) => {
        const row = payload.new as SettlementRow;
        setSettlementRows((prev) => (prev.some((s) => s.id === row.id) ? prev : [row, ...prev]));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const upsert = (row: PaymentAttemptRow) =>
      setPaymentAttemptRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
    const channel = supabase
      .channel('split-payment-attempts-all')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payment_attempts' }, (payload) => upsert(payload.new as PaymentAttemptRow))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payment_attempts' }, (payload) => upsert(payload.new as PaymentAttemptRow))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const value: SplitContextValue = {
    loading,
    refreshing,
    refresh,
    page,
    groups,
    focusedGroup,
    membersFor,
    expensesFor,
    settlementsFor,
    chatFor,
    balancesFor,
    nameFor,
    upiProfileFor,
    paymentAttemptsFor,
    focusedPaymentAttempt,
    pendingPayment,
    goHome,
    goDashboard,
    openGroup,
    goCreate,
    goAdd,
    goItems,
    goSettle,
    goChat,
    goPayConfirm,
    goPayStatus,
    createGroup,
    updateGroup,
    joinGroup,
    addKnownMember,
    deleteGroup,
    addExpense,
    settleUp,
    sendChat,
    createUpiPayment,
    markUpiPaymentSent,
    confirmUpiPayment,
    cancelUpiPayment,
    remindUpiSetup,
    refreshPaymentAttempt,
    addMembersOpen,
    openAddMembers: () => setAddMembersOpen(true),
    closeAddMembers: () => setAddMembersOpen(false),
    confirmLeaveOpen,
    askLeave: () => {
      if (focusedGroup && !focusedGroup.isOwner) setConfirmLeaveOpen(true);
    },
    cancelLeave: () => setConfirmLeaveOpen(false),
    leaveGroup,
  };

  return <SplitContext.Provider value={value}>{children}</SplitContext.Provider>;
}

export function useSplit(): SplitContextValue {
  const ctx = useContext(SplitContext);
  if (!ctx) throw new Error('useSplit must be used within a SplitProvider');
  return ctx;
}
