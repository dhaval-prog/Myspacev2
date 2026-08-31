import React from 'react';
import { SplitProvider, useSplit } from '../../context/SplitContext';
import { SplitHomeScreen } from './SplitHomeScreen';
import { SplitDashboardScreen } from './SplitDashboardScreen';
import { AddExpenseScreen } from './AddExpenseScreen';
import { ItemSplitScreen } from './ItemSplitScreen';
import { SettleUpScreen } from './SettleUpScreen';
import { SplitChatScreen } from './SplitChatScreen';
import { CreateSplitScreen } from './CreateSplitScreen';
import { PaymentConfirmScreen } from './PaymentConfirmScreen';
import { PaymentStatusScreen } from './PaymentStatusScreen';
import type { NotificationTarget } from '../../utils/notify';

interface SplitScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenAccount: () => void;
  /** Opens straight into this group's dashboard — set when arriving from a notification about it. */
  focusGroupId?: string;
  onOpenNotificationTarget?: (target: NotificationTarget) => void;
}

function SplitRoot({ onHome, onOpenExpenses, onOpenAccount, onOpenNotificationTarget }: SplitScreenProps) {
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
    case 'pay-confirm':
      return <PaymentConfirmScreen />;
    case 'pay-status':
      return <PaymentStatusScreen />;
    default:
      return (
        <SplitHomeScreen onHome={onHome} onOpenExpenses={onOpenExpenses} onOpenAccount={onOpenAccount} onOpenNotificationTarget={onOpenNotificationTarget} />
      );
  }
}

/** The Split feature: spaces list, per-split dashboard, and every screen it opens. */
export function SplitScreen({ onHome, onOpenExpenses, onOpenAccount, focusGroupId, onOpenNotificationTarget }: SplitScreenProps) {
  return (
    <SplitProvider initialGroupId={focusGroupId}>
      <SplitRoot onHome={onHome} onOpenExpenses={onOpenExpenses} onOpenAccount={onOpenAccount} onOpenNotificationTarget={onOpenNotificationTarget} />
    </SplitProvider>
  );
}
