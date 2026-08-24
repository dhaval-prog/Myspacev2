/**
 * Bottom navigation destinations, data-driven per the MySpace reference.
 * `align` places the item left or right of the centered add action.
 */
export interface NavItem {
  id: string;
  icon: string;
  label: string;
  align: 'left' | 'right';
}

export const navItems: NavItem[] = [
  { id: 'home', icon: '⌂', label: 'Home', align: 'left' },
  { id: 'expenses', icon: '▤', label: 'Expenses', align: 'left' },
  { id: 'piggy', icon: '₹', label: 'Piggy', align: 'right' },
  { id: 'split', icon: '⇄', label: 'Split', align: 'right' },
];
