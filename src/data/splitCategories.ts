export interface SplitCategoryDef {
  label: string;
  tile: string;
  icon: string;
}

/** Categories offered when creating a split, with their icon-tile look. */
export const SPLIT_CATEGORIES: SplitCategoryDef[] = [
  { label: 'Home', tile: '#E6F0D8', icon: 'M4 10.6L12 4.4l8 6.2V19a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19v-8.4z' },
  { label: 'Trip', tile: '#DCE7FF', icon: 'M4 8V5.6A1.6 1.6 0 0 1 5.6 4H8M16 4h2.4A1.6 1.6 0 0 1 20 5.6V8M20 16v2.4a1.6 1.6 0 0 1-1.6 1.6H16M8 20H5.6A1.6 1.6 0 0 1 4 18.4V16M7 12h10' },
  { label: 'Food', tile: '#FFE1C2', icon: 'M6 4v7a2.6 2.6 0 0 0 5.2 0V4M8.6 11v9M17 4c1.6 1.4 2 3.4 1.4 5.2-.4 1.2-1.4 1.8-1.4 3V20' },
  { label: 'Event', tile: '#EDE4FF', icon: 'M4 6h16v12H4zM8 6v12M16 6v12' },
  { label: 'Couple', tile: '#FDE8EE', icon: 'M12 21s-7-4.35-9.5-8.5C.7 9 2 5.5 5.5 5c2-.3 3.7.9 4.5 2 .8-1.1 2.5-2.3 4.5-2 3.5.5 4.8 4 3 7.5C19 16.65 12 21 12 21z' },
  { label: 'Work', tile: '#FFE9C7', icon: 'M5.5 3h13v18h-13zM5.5 8h13M12 11.5a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4' },
  { label: 'Other', tile: '#EEEEEA', icon: 'M5 12h.01M12 12h.01M19 12h.01' },
];

export const SPLIT_CATEGORY_MAP: Record<string, SplitCategoryDef> = SPLIT_CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.label]: c }),
  {},
);
