import React from 'react';
import { SplitProvider, useSplit } from '../../context/SplitContext';
import { SplitHomeScreen } from './SplitHomeScreen';
import { SplitDashboardScreen } from './SplitDashboardScreen';
import { AddExpenseScreen } from './AddExpenseScreen';
import { ItemSplitScreen } from './ItemSplitScreen';
import { SettleUpScreen } from './SettleUpScreen';
import { SplitChatScreen } from './SplitChatScreen';
import { CreateSplitScreen } from './CreateSplitScreen';

interface SplitScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
}

function SplitRoot({ onHome, onOpenExpenses }: SplitScreenProps) {
  const { page } = useSplit();
  switch (page) {
    case 'dashboard':
      return <SplitDashboardScreen />;
    case 'add':
      return <AddExpenseScreen />;
    case 'items':
      return <ItemSplitScreen />;
    case 'settle':
      return <SettleUpScreen />;
    case 'chat':
      return <SplitChatScreen />;
    case 'create':
      return <CreateSplitScreen />;
    default:
      return <SplitHomeScreen onHome={onHome} onOpenExpenses={onOpenExpenses} />;
  }
}

/** The Split feature: spaces list, per-split dashboard, and every screen it opens. */
export function SplitScreen({ onHome, onOpenExpenses }: SplitScreenProps) {
  return (
    <SplitProvider>
      <SplitRoot onHome={onHome} onOpenExpenses={onOpenExpenses} />
    </SplitProvider>
  );
}
