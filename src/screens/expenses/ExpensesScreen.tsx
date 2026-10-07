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
import { BudgetResetPrompt } from '../../components/expenses/BudgetResetPrompt';
import { TransferCardPickerSheet } from '../../components/expenses/TransferCardPickerSheet';
import type { NotificationTarget } from '../../utils/notify';

interface ExpensesScreenProps {
  onHome: () => void;
  onOpenThrow: () => void;
  onOpenChats: () => void;
  onOpenMap: () => void;
  onOpenAccount: () => void;
  /** Opens straight into this card's wallet — set when arriving from a notification about it. */
  focusCardId?: string;
  onOpenNotificationTarget?: (target: NotificationTarget) => void;
}

function ExpensesRoot({ onHome, onOpenThrow, onOpenChats, onOpenMap, onOpenAccount, onOpenNotificationTarget }: ExpensesScreenProps) {
  const { page } = useExpenses();
  return (
    <>
      {page === 'wallet' ? (
        <WalletScreen onHome={onHome} />
      ) : (
        <PickScreen
          onOpenThrow={onOpenThrow}
          onOpenChats={onOpenChats}
          onOpenMap={onOpenMap}
          onOpenAccount={onOpenAccount}
          onOpenNotificationTarget={onOpenNotificationTarget}
        />
      )}
      <AddSpendSheet />
      <AddMoneySheet />
      <NewCardSheet />
      <HistorySheet />
      <MembersSheet />
      <InviteSheet />
      <JoinCardSheet />
      <ConfirmDeleteModal />
      <BudgetResetPrompt />
      <TransferCardPickerSheet />
    </>
  );
}

/** Card-stack picker + per-card wallet, plus every modal it can open. */
export function ExpensesScreen({ onHome, onOpenThrow, onOpenChats, onOpenMap, onOpenAccount, focusCardId, onOpenNotificationTarget }: ExpensesScreenProps) {
  return (
    <ExpensesProvider initialCardId={focusCardId}>
      <ExpensesRoot
        onHome={onHome}
        onOpenThrow={onOpenThrow}
        onOpenChats={onOpenChats}
        onOpenMap={onOpenMap}
        onOpenAccount={onOpenAccount}
        onOpenNotificationTarget={onOpenNotificationTarget}
      />
    </ExpensesProvider>
  );
}
