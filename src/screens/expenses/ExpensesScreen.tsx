import React from 'react';
import { ExpensesProvider, useExpenses } from '../../context/ExpensesContext';
import { PickScreen } from './PickScreen';
import { WalletScreen } from './WalletScreen';
import { AddSpendSheet } from '../../components/expenses/AddSpendSheet';
import { AddMoneySheet } from '../../components/expenses/AddMoneySheet';
import { NewCardSheet } from '../../components/expenses/NewCardSheet';
import { HistorySheet } from '../../components/expenses/HistorySheet';
import { InviteSheet } from '../../components/expenses/InviteSheet';
import { JoinCardSheet } from '../../components/expenses/JoinCardSheet';
import { ConfirmDeleteModal } from '../../components/expenses/ConfirmDeleteModal';

interface ExpensesScreenProps {
  onHome: () => void;
  onOpenSplit: () => void;
}

function ExpensesRoot({ onHome, onOpenSplit }: ExpensesScreenProps) {
  const { page } = useExpenses();
  return (
    <>
      {page === 'wallet' ? <WalletScreen onHome={onHome} /> : <PickScreen onHome={onHome} onOpenSplit={onOpenSplit} />}
      <AddSpendSheet />
      <AddMoneySheet />
      <NewCardSheet />
      <HistorySheet />
      <InviteSheet />
      <JoinCardSheet />
      <ConfirmDeleteModal />
    </>
  );
}

/** Card-stack picker + per-card wallet, plus every modal it can open. */
export function ExpensesScreen({ onHome, onOpenSplit }: ExpensesScreenProps) {
  return (
    <ExpensesProvider>
      <ExpensesRoot onHome={onHome} onOpenSplit={onOpenSplit} />
    </ExpensesProvider>
  );
}
