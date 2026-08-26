export interface SplitCategoryDef {
  label: string;
  tile: string;
  icon: string;
}

/** Categories offered when creating a split, with their icon-tile look. */
export const SPLIT_CATEGORIES: SplitCategoryDef[] = [
  { label: 'Trip', tile: '#DCE7FF', icon: 'M12 3.5v17M5 20.5h14M4 11.5c1.6-4.5 4.4-6.6 8-6.6s6.4 2.1 8 6.6c-2.4-1.6-4.7-1.6-7 0-2.6-1.7-5.3-1.7-9 0z' },
  { label: 'Home', tile: '#E6F0D8', icon: 'M4 10.6L12 4.4l8 6.2V19a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19v-8.4z' },
  { label: 'Food', tile: '#FFE1C2', icon: 'M7 3.5v8M4.5 3.5v4a2.5 2.5 0 0 0 5 0v-4M7 11.5v9M16.5 3.5c-1.6 1.2-2.4 3-2.4 5.2 0 1.6.8 2.6 2.4 2.8v9' },
  { label: 'Event', tile: '#EDE4FF', icon: 'M4 6h16v12H4zM8 6v12M16 6v12' },
  { label: 'Family', tile: '#FDE8EE', icon: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3 2.5-5 6-5s6 2 6 5M16 8a2.5 2.5 0 1 0 0-5M17 20c0-2-1-3.5-2.5-4.5' },
  { label: 'Friends', tile: '#FFE9C7', icon: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 2.7-5 6-5s6 2 6 5M10 20c0-2.5 2-4.5 4-4.5s4 2 4 4.5' },
  { label: 'Custom', tile: '#EEEEEA', icon: 'M12 2v20M4.2 7l15.6 10M4.2 17L19.8 7' },
];

export const SPLIT_CATEGORY_MAP: Record<string, SplitCategoryDef> = SPLIT_CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.label]: c }),
  {},
);
