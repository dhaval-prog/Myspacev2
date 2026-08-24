/**
 * Home category navigation — data-driven so new sections (or a reordering)
 * never require touching CategoryNavigation itself. Content mirrors the
 * MySpace reference: three ways into the space, nothing else.
 */
export interface CategoryItem {
  id: string;
  mono: string;
  title: string;
}

export interface Category {
  id: string;
  label: string;
  /** Circular badge content — a live count, or "+" for a creation action. */
  count: string;
  /** Hero supporting line shown while this category is selected. */
  heroLine: string;
  items: CategoryItem[];
}

export const categories: Category[] = [
  {
    id: 'rooms',
    label: 'Rooms',
    count: '4',
    heroLine: 'Four rooms, eighteen places.',
    items: [
      { id: 'kitchen', mono: 'KT', title: 'Kitchen' },
      { id: 'bedroom', mono: 'BD', title: 'Bedroom' },
      { id: 'study', mono: 'BR', title: 'Study' },
      { id: 'hall', mono: 'HL', title: 'Hall' },
    ],
  },
  {
    id: 'attention',
    label: 'Needs attention',
    count: '4',
    heroLine: 'Four open loops — one expired, one bill, two renewals.',
    items: [
      { id: 'milk', mono: 'MK', title: 'Milk, 1L' },
      { id: 'wifi', mono: 'WF', title: 'Wi-Fi bill' },
      { id: 'pass', mono: 'PP', title: 'Passport' },
      { id: 'amox', mono: 'RX', title: 'Amoxicillin' },
    ],
  },
  {
    id: 'add',
    label: 'Add item',
    count: '+',
    heroLine: 'Your space — say it, scan it, or type it.',
    items: [{ id: 'items', mono: '▤', title: 'Items' }],
  },
];
