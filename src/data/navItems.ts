/**
 * Bottom navigation destinations, data-driven per the MySpace reference.
 * `align` places the item left or right of the centered add action.
 * `icon` is an SVG path drawn via the shared `Icon` component.
 */
export interface NavItem {
  id: string;
  icon: string;
  label: string;
  align: 'left' | 'right';
}

export const navItems: NavItem[] = [
  { id: 'home', icon: 'M4 10.6L12 4.4l8 6.2V19a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19v-8.4z', label: 'Home', align: 'left' },
  { id: 'expenses', icon: 'M5 4.5h14v15H5zM8 8.5h8M8 12h8M8 15.5h5', label: 'Expenses', align: 'left' },
  { id: 'split', icon: 'M4 9h11l-3-3M20 15H9l3 3', label: 'Split', align: 'right' },
];
