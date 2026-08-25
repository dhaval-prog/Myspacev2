import React from 'react';
import { ExpensesProvider, useExpenses } from '../../context/ExpensesContext';
import { PickScreen } from './PickScreen';
import { WalletScreen } from './WalletScreen';
import { AddSpendSheet } from '../../components/expenses/AddSpendSheet';
import { NewCardSheet } from '../../components/expenses/NewCardSheet';
import { HistorySheet } from '../../components/expenses/HistorySheet';
import { InviteSheet } from '../../components/expenses/InviteSheet';
import { ConfirmDeleteModal } from '../../components/expenses/ConfirmDeleteModal';

interface ExpensesScreenProps {
  onHome: () => void;
}

function ExpensesRoot({ onHome }: ExpensesScreenProps) {
  const { page } = useExpenses();
  return (
    <>
      {page === 'wallet' ? <WalletScreen onHome={onHome} /> : <PickScreen onHome={onHome} />}
      <AddSpendSheet />
      <NewCardSheet />
      <HistorySheet />
      <InviteSheet />
      <ConfirmDeleteModal />
    </>
  );
}

/** Card-stack picker + per-card wallet, plus every modal it can open. */
export function ExpensesScreen({ onHome }: ExpensesScreenProps) {
  return (
    <ExpensesProvider>
      <ExpensesRoot onHome={onHome} />
    </ExpensesProvider>
  );
}
