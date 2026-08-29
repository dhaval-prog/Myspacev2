import React from 'react';
import { ConfirmDialog } from '../ConfirmDialog';
import { useExpenses } from '../../context/ExpensesContext';

/** Owner-only reset-day prompt: start a fresh cycle, or keep the balance carrying over. */
export function BudgetResetPrompt() {
  const { resetPrompt, confirmBudgetReset, continueBudgetCycle } = useExpenses();

  return (
    <ConfirmDialog
      visible={resetPrompt !== null}
      title="Reset day"
      message={
        resetPrompt
          ? `It's "${resetPrompt.label}"'s reset day. Reset the budget back to ${resetPrompt.amount}, or keep continuing with the current balance?`
          : ''
      }
      confirmLabel="Reset budget"
      cancelLabel="Continue"
      onConfirm={confirmBudgetReset}
      onCancel={continueBudgetCycle}
    />
  );
}
