export interface SpendCategoryDef {
  label: string;
  tile: string;
  icon: string;
}

/** Categories offered on the Add Spend form, with their icon-tile look. */
export const SPEND_CATEGORIES: SpendCategoryDef[] = [
  {
    label: 'Groceries',
    tile: '#F6D3D6',
    icon: 'M5 8h14l-1.4 11.2a1.4 1.4 0 0 1-1.4 1.2H7.8a1.4 1.4 0 0 1-1.4-1.2L5 8zM9 8V6.2a3 3 0 0 1 6 0V8',
  },
  {
    label: 'Household',
    tile: '#E6F0D8',
    icon: 'M4 10.6L12 4.4l8 6.2V19a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19v-8.4z',
  },
  { label: 'Outing', tile: '#EDE4FF', icon: 'M4 6h16v12H4zM8 6v12M16 6v12' },
  {
    label: 'Personal',
    tile: '#D8E4FF',
    icon: 'M12 11.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8M5.6 20c0-3.2 2.8-5.4 6.4-5.4s6.4 2.2 6.4 5.4',
  },
  {
    label: 'Shopping',
    tile: '#FFD9CF',
    icon: 'M4 5h2.2l2.3 9.4h8.6L19 8H7M9.5 19.4a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2M16.5 19.4a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2',
  },
  { label: 'Utilities', tile: '#FFE9A3', icon: 'M13.5 3L6.5 13.2h4.3L10 21l7.2-10.4h-4.4L13.5 3z' },
  {
    label: 'Food',
    tile: '#FFE1C2',
    icon: 'M6 4v7a2.6 2.6 0 0 0 5.2 0V4M8.6 11v9M17 4c1.6 1.4 2 3.4 1.4 5.2-.4 1.2-1.4 1.8-1.4 3V20',
  },
  { label: 'Other', tile: '#EEEEEA', icon: 'M5 12h.01M12 12h.01M19 12h.01' },
];

export const SPEND_CATEGORY_MAP: Record<string, SpendCategoryDef> = SPEND_CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.label]: c }),
  {},
);
