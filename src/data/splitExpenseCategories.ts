export interface SplitExpenseCategoryDef {
  label: string;
  icon: string;
}

/** Quick-title presets offered on the split Add Expense form, each with its Recent Expenses icon. */
export const SPLIT_EXPENSE_CATEGORIES: SplitExpenseCategoryDef[] = [
  { label: 'Dinner', icon: 'M6 4v7a2.6 2.6 0 0 0 5.2 0V4M8.6 11v9M17 4c1.6 1.4 2 3.4 1.4 5.2-.4 1.2-1.4 1.8-1.4 3V20' },
  { label: 'Stay', icon: 'M4 19v-9l8-5 8 5v9M9.5 19v-5h5v5' },
  { label: 'Travel', icon: 'M5.5 17.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 17.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8 15h8l-3-8H9' },
  { label: 'Drinks', icon: 'M5 8h13a2 2 0 0 1 0 4h-1M5 8v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V8M5 8V5h10v3' },
];

/** Fallback icon for an expense whose category isn't one of the presets above. */
export const SPLIT_EXPENSE_ICON_DEFAULT = 'M4 8h16v12H4zM4 8l2-4h12l2 4M12 8v12';

export const SPLIT_EXPENSE_ICON_MAP: Record<string, string> = SPLIT_EXPENSE_CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.label]: c.icon }),
  {},
);
