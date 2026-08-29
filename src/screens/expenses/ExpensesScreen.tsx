import React from 'react';
import { ExpensesProvider, useExpenses } from '../../context/ExpensesContext';
import { PickScreen } from './PickScreen';
import { WalletScreen } from './WalletScreen';
import { AddSpendSheet } from '../../components/expenses/AddSpendSheet';
import { AddMoneySheet } from '../../components/expenses/AddMoneySheet';
import { NewCardSheet } from '../../components/expenses/NewCardSheet';
import { HistorySheet } from '../../components/expenses/HistorySheet';
import { MembersSheet } from '../../components/expenses/MembersSheet';
import { InviteSheet } from '../../components/expenses/InviteSheet';
import { JoinCardSheet } from '../../components/expenses/JoinCardSheet';
import { ConfirmDeleteModal } from '../../components/expenses/ConfirmDeleteModal';

interface ExpensesScreenProps {
  onHome: () => void;
  onOpenSplit: () => void;
  onOpenAccount: () => void;
}

function ExpensesRoot({ onHome, onOpenSplit, onOpenAccount }: ExpensesScreenProps) {
  const { page } = useExpenses();
  return (
    <>
      {page === 'wallet' ? <WalletScreen onHome={onHome} /> : <PickScreen onHome={onHome} onOpenSplit={onOpenSplit} onOpenAccount={onOpenAccount} />}
      <AddSpendSheet />
      <AddMoneySheet />
      <NewCardSheet />
      <HistorySheet />
      <MembersSheet />
      <InviteSheet />
      <JoinCardSheet />
      <ConfirmDeleteModal />
    </>
  );
}

/** Card-stack picker + per-card wallet, plus every modal it can open. */
export function ExpensesScreen({ onHome, onOpenSplit, onOpenAccount }: ExpensesScreenProps) {
  return (
    <ExpensesProvider>
      <ExpensesRoot onHome={onHome} onOpenSplit={onOpenSplit} onOpenAccount={onOpenAccount} />
    </ExpensesProvider>
  );
}
