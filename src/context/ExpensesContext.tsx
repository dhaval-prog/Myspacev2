import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Expense, MemberSpend, WalletCard } from '../types/expenses';
import { CARD_PALETTE } from '../data/expensesSeed';
import { SPEND_CATEGORY_MAP } from '../data/expenseCategories';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  formatMoney,
  longDateLabel,
  maskRid,
  nextResetLabel,
  parseAmount,
  parseDateOnly,
  randomRid,
  toDateOnly,
} from '../utils/expensesFormat';

type Page = 'pick' | 'wallet';

interface NewExpenseInput {
  title: string;
  amount: number;
  category: string;
  date: Date;
}

interface NewCardInput {
  name: string;
  amount: number;
  resetDay: string;
}

interface CardRow {
  id: string;
  owner_id: string;
  label: string;
  bg: string;
  ink: string;
  sub: string;
  art_a: string;
  art_b: string;
  amount: number;
  rid: string;
  reset_day: string;
}

interface ExpenseRow {
  id: string;
  card_id: string;
  user_id: string;
  title: string;
  amount: number;
  category: string;
  spent_on: string;
}

function toWalletCard(row: CardRow, userId: string | null): WalletCard {
  return {
    id: row.id,
    label: row.label,
    bg: row.bg,
    ink: row.ink,
    sub: row.sub,
    amount: formatMoney(row.amount),
    rid: row.rid,
    digits: maskRid(row.rid),
    exp: nextResetLabel(row.reset_day),
    expLabel: 'Resets on',
    artA: row.art_a,
    artB: row.art_b,
    isOwner: row.owner_id === userId,
  };
}

function toExpense(row: ExpenseRow): Expense {
  const catDef = SPEND_CATEGORY_MAP[row.category] ?? SPEND_CATEGORY_MAP.Other;
  return {
    title: row.title,
    date: longDateLabel(parseDateOnly(row.spent_on)),
    amt: `-₹${Math.round(row.amount).toLocaleString('en-IN')}`,
    tile: catDef.tile,
    icon: catDef.icon,
    userId: row.user_id,
  };
}

function warn(action: string, error: { message: string } | null) {
  if (error) console.warn(`[expenses] failed to ${action}:`, error.message);
}

interface ExpensesContextValue {
  page: Page;
  deck: WalletCard[];
  sel: number;
  dot: number;
  setDot: (i: number) => void;
  /** Index (in `deck`) currently mid fly-up-to-open animation, or null. */
  flyCard: number | null;
  openCard: (i: number) => void;
  backToPick: () => void;
  focusedIdx: number;
  focusedCard: WalletCard | undefined;
  expensesFor: (card: WalletCard | undefined) => Expense[];
  /** Per-member spend totals on a card, highest first — for History's breakdown. */
  memberSpendsFor: (card: WalletCard | undefined) => MemberSpend[];
  addExpense: (input: NewExpenseInput) => void;
  addCard: (input: NewCardInput) => void;
  deleteFocusedCard: () => void;
  joinCard: (code: string) => Promise<{ error: string | null }>;

  spendOpen: boolean;
  openSpend: () => void;
  closeSpend: () => void;
  historyOpen: boolean;
  openHistory: () => void;
  closeHistory: () => void;
  inviteOpen: boolean;
  openInvite: () => void;
  closeInvite: () => void;
  confirmDeleteOpen: boolean;
  askDelete: () => void;
  cancelDelete: () => void;
  newCardOpen: boolean;
  openNewCard: () => void;
  closeNewCard: () => void;
  joinOpen: boolean;
  openJoin: () => void;
  closeJoin: () => void;
}

const ExpensesContext = createContext<ExpensesContextValue | null>(null);

/**
 * State for the whole Expenses feature (card picker + per-card wallet).
 * Persisted to Supabase: a card's `budget_cards` row is only ever visible
 * to its owner and to accounts that redeemed its join code (`card_members`,
 * granted only through the `join_budget_card` RPC) — enforced by RLS, not
 * just this client. A fresh account starts with zero cards.
 */
export function ExpensesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [cardRows, setCardRows] = useState<CardRow[]>([]);
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [page, setPage] = useState<Page>('pick');
  const [sel, setSel] = useState(0);
  const [dot, setDot] = useState(0);
  const [flyCard, setFlyCard] = useState<number | null>(null);

  const [spendOpen, setSpendOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const localRef = useRef({ cardSeq: 0, expenseSeq: 0 });

  useEffect(() => {
    let cancelled = false;

    if (!userId || !isSupabaseConfigured) {
      setCardRows([]);
      setExpenseRows([]);
      return;
    }

    (async () => {
      const [cardsRes, expensesRes] = await Promise.all([
        supabase.from('budget_cards').select('*').order('created_at', { ascending: true }),
        supabase.from('card_expenses').select('*').order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;

      warn('load cards', cardsRes.error);
      warn('load expenses', expensesRes.error);

      setCardRows((cardsRes.data as CardRow[] | null) ?? []);
      setExpenseRows((expensesRes.data as ExpenseRow[] | null) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Backfills display names for whoever logged an expense (self or a
  // co-member on a shared card) — fetched lazily as new spenders show up,
  // never refetching a name already in hand.
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const missing = Array.from(new Set(expenseRows.map((r) => r.user_id))).filter((id) => !(id in profileNames));
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
    // profileNames deliberately excluded — it's read to find gaps, not to retrigger on every fill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseRows, userId]);

  const deck = useMemo(() => cardRows.map((row) => toWalletCard(row, userId)), [cardRows, userId]);
  const focusedIdx = deck.length ? (sel + dot) % deck.length : 0;
  const focusedCard = deck[focusedIdx];

  const expensesFor = (card: WalletCard | undefined) =>
    card ? expenseRows.filter((r) => r.card_id === card.id).map(toExpense) : [];

  const memberSpendsFor = (card: WalletCard | undefined): MemberSpend[] => {
    if (!card) return [];
    const totals = new Map<string, number>();
    for (const row of expenseRows) {
      if (row.card_id !== card.id) continue;
      totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + row.amount);
    }
    return Array.from(totals.entries())
      .map(([id, total]) => ({ userId: id, name: profileNames[id] ?? 'Member', total }))
      .sort((a, b) => b.total - a.total);
  };

  const openCard = (i: number) => {
    setFlyCard(i);
    setTimeout(() => {
      setPage('wallet');
      setSel(i);
      setDot(0);
      setFlyCard(null);
    }, 340);
  };

  const backToPick = () => setPage('pick');

  const addExpense = ({ title, amount, category, date }: NewExpenseInput) => {
    if (!focusedCard || !title.trim() || amount <= 0) return;
    const cardId = focusedCard.id;
    const spentOn = toDateOnly(date);
    const trimmedTitle = title.trim();
    setSpendOpen(false);

    if (!userId || !isSupabaseConfigured) {
      localRef.current.expenseSeq += 1;
      setExpenseRows((prev) => [
        {
          id: `local-expense-${localRef.current.expenseSeq}`,
          card_id: cardId,
          user_id: userId ?? 'local',
          title: trimmedTitle,
          amount,
          category,
          spent_on: spentOn,
        },
        ...prev,
      ]);
      return;
    }

    supabase
      .from('card_expenses')
      .insert({ card_id: cardId, user_id: userId, title: trimmedTitle, amount, category, spent_on: spentOn })
      .select('*')
      .single()
      .then(({ data, error }) => {
        warn('add expense', error);
        if (data) setExpenseRows((prev) => [data as ExpenseRow, ...prev]);
      });
  };

  const addCard = ({ name, amount, resetDay }: NewCardInput) => {
    const trimmedName = name.trim();
    if (!trimmedName || amount <= 0) return;
    const skin = CARD_PALETTE[cardRows.length % CARD_PALETTE.length];
    const rid = randomRid();
    setNewCardOpen(false);

    if (!userId || !isSupabaseConfigured) {
      localRef.current.cardSeq += 1;
      setCardRows((prev) => [
        ...prev,
        {
          id: `local-card-${localRef.current.cardSeq}`,
          owner_id: userId ?? 'local',
          label: trimmedName,
          bg: skin.bg,
          ink: skin.ink,
          sub: skin.sub,
          art_a: skin.artA,
          art_b: skin.artB,
          amount,
          rid,
          reset_day: resetDay,
        },
      ]);
      return;
    }

    supabase
      .from('budget_cards')
      .insert({
        owner_id: userId,
        label: trimmedName,
        bg: skin.bg,
        ink: skin.ink,
        sub: skin.sub,
        art_a: skin.artA,
        art_b: skin.artB,
        amount,
        rid,
        reset_day: resetDay,
      })
      .select('*')
      .single()
      .then(({ data, error }) => {
        warn('add card', error);
        if (data) setCardRows((prev) => [...prev, data as CardRow]);
      });
  };

  const deleteFocusedCard = () => {
    if (!focusedCard || !focusedCard.isOwner) return;
    const idx = focusedIdx;
    const cardId = focusedCard.id;

    setCardRows((prev) => prev.filter((c) => c.id !== cardId));
    setExpenseRows((prev) => prev.filter((r) => r.card_id !== cardId));

    const nextLen = deck.length - 1;
    if (nextLen <= 0) {
      setPage('pick');
      setSel(0);
      setDot(0);
    } else {
      setSel(Math.min(idx, nextLen - 1));
      setDot(0);
    }
    setConfirmDeleteOpen(false);

    if (userId && isSupabaseConfigured) {
      supabase
        .from('budget_cards')
        .delete()
        .eq('id', cardId)
        .then(({ error }) => warn('delete card', error));
    }
  };

  const joinCard = async (code: string): Promise<{ error: string | null }> => {
    const rid = code.replace(/\D/g, '');
    if (rid.length !== 11) return { error: 'Enter the full 11-digit code.' };
    if (!userId || !isSupabaseConfigured) return { error: 'Not signed in.' };

    const { data, error } = await supabase.rpc('join_budget_card', { p_rid: rid });
    if (error) return { error: error.message.includes('Invalid join code') ? 'That code doesn’t match a card.' : error.message };

    const row = data as CardRow;
    setCardRows((prev) => (prev.some((c) => c.id === row.id) ? prev : [...prev, row]));

    if (row.owner_id !== userId) {
      const { data: expenseData, error: expenseError } = await supabase.from('card_expenses').select('*').eq('card_id', row.id);
      warn('load joined card expenses', expenseError);
      if (expenseData) {
        setExpenseRows((prev) => [...prev.filter((r) => r.card_id !== row.id), ...(expenseData as ExpenseRow[])]);
      }
    }

    setJoinOpen(false);
    return { error: null };
  };

  const value: ExpensesContextValue = {
    page,
    deck,
    sel,
    dot,
    setDot,
    flyCard,
    openCard,
    backToPick,
    focusedIdx,
    focusedCard,
    expensesFor,
    memberSpendsFor,
    addExpense,
    addCard,
    deleteFocusedCard,
    joinCard,
    spendOpen,
    openSpend: () => setSpendOpen(true),
    closeSpend: () => setSpendOpen(false),
    historyOpen,
    openHistory: () => setHistoryOpen(true),
    closeHistory: () => setHistoryOpen(false),
    inviteOpen,
    openInvite: () => {
      if (focusedCard?.isOwner) setInviteOpen(true);
    },
    closeInvite: () => setInviteOpen(false),
    confirmDeleteOpen,
    askDelete: () => {
      if (focusedCard?.isOwner) setConfirmDeleteOpen(true);
    },
    cancelDelete: () => setConfirmDeleteOpen(false),
    newCardOpen,
    openNewCard: () => setNewCardOpen(true),
    closeNewCard: () => setNewCardOpen(false),
    joinOpen,
    openJoin: () => setJoinOpen(true),
    closeJoin: () => setJoinOpen(false),
  };

  return <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>;
}

export function useExpenses(): ExpensesContextValue {
  const ctx = useContext(ExpensesContext);
  if (!ctx) throw new Error('useExpenses must be used within an ExpensesProvider');
  return ctx;
}
