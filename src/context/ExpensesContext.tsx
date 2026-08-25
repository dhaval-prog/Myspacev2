import React, { createContext, useContext, useMemo, useRef, useState } from 'react';
import type { Expense, WalletCard } from '../types/expenses';
import { NEW_CARD_PALETTE, seedDeck } from '../data/expensesSeed';
import { SPEND_CATEGORY_MAP } from '../data/expenseCategories';
import { formatMoney, longDateLabel, nextResetLabel, randomRid } from '../utils/expensesFormat';

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
  addExpense: (input: NewExpenseInput) => void;
  addCard: (input: NewCardInput) => void;
  deleteFocusedCard: () => void;

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
}

const ExpensesContext = createContext<ExpensesContextValue | null>(null);

/**
 * State for the whole Expenses feature (card picker + per-card wallet).
 * Scoped to the Expenses screen subtree only — unlike SpaceContext this
 * never needs to be read outside it, so it's provided locally rather
 * than from App.tsx.
 */
export function ExpensesProvider({ children }: { children: React.ReactNode }) {
  const seedsRef = useRef<WalletCard[] | null>(null);
  if (!seedsRef.current) seedsRef.current = seedDeck();

  const [seeds, setSeeds] = useState<WalletCard[]>(seedsRef.current);
  const [newCards, setNewCards] = useState<WalletCard[]>([]);
  const [page, setPage] = useState<Page>('pick');
  const [sel, setSel] = useState(0);
  const [dot, setDot] = useState(0);
  const [flyCard, setFlyCard] = useState<number | null>(null);
  const [expensesByCard, setExpensesByCard] = useState<Record<string, Expense[]>>({});

  const [spendOpen, setSpendOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [newCardOpen, setNewCardOpen] = useState(false);

  const deck = useMemo(() => [...seeds, ...newCards], [seeds, newCards]);
  const focusedIdx = deck.length ? (sel + dot) % deck.length : 0;
  const focusedCard = deck[focusedIdx];

  const expensesFor = (card: WalletCard | undefined) => (card ? (expensesByCard[card.rid] ?? []) : []);

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
    const catDef = SPEND_CATEGORY_MAP[category] ?? SPEND_CATEGORY_MAP.Other;
    const entry: Expense = {
      title: title.trim(),
      date: longDateLabel(date),
      amt: `-₹${Math.round(amount).toLocaleString('en-IN')}`,
      tile: catDef.tile,
      icon: catDef.icon,
    };
    const key = focusedCard.rid;
    setExpensesByCard((prev) => ({ ...prev, [key]: [entry, ...(prev[key] ?? [])] }));
    setSpendOpen(false);
  };

  const addCard = ({ name, amount, resetDay }: NewCardInput) => {
    if (!name.trim() || amount <= 0) return;
    const skin = NEW_CARD_PALETTE[newCards.length % NEW_CARD_PALETTE.length];
    const rid = randomRid();
    const card: WalletCard = {
      ...skin,
      label: name.trim(),
      amount: formatMoney(amount),
      digits: `*** **** ${rid.slice(7)}`,
      rid,
      exp: nextResetLabel(resetDay),
      expLabel: 'Resets on',
    };
    setNewCards((prev) => [...prev, card]);
    setNewCardOpen(false);
  };

  const deleteFocusedCard = () => {
    if (!focusedCard) return;
    const idx = focusedIdx;
    const isSeed = idx < seeds.length;
    if (isSeed) {
      setSeeds((prev) => prev.filter((c) => c.rid !== focusedCard.rid));
    } else {
      setNewCards((prev) => prev.filter((c) => c.rid !== focusedCard.rid));
    }
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
    addExpense,
    addCard,
    deleteFocusedCard,
    spendOpen,
    openSpend: () => setSpendOpen(true),
    closeSpend: () => setSpendOpen(false),
    historyOpen,
    openHistory: () => setHistoryOpen(true),
    closeHistory: () => setHistoryOpen(false),
    inviteOpen,
    openInvite: () => setInviteOpen(true),
    closeInvite: () => setInviteOpen(false),
    confirmDeleteOpen,
    askDelete: () => setConfirmDeleteOpen(true),
    cancelDelete: () => setConfirmDeleteOpen(false),
    newCardOpen,
    openNewCard: () => setNewCardOpen(true),
    closeNewCard: () => setNewCardOpen(false),
  };

  return <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>;
}

export function useExpenses(): ExpensesContextValue {
  const ctx = useContext(ExpensesContext);
  if (!ctx) throw new Error('useExpenses must be used within an ExpensesProvider');
  return ctx;
}
