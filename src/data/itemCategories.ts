export interface CategoryDef {
  label: string;
  /** SVG path data, 24x24 viewBox. */
  icon: string;
  mono: string;
}

/** Icon shown before a category is chosen. */
export const EMPTY_CATEGORY_ICON = 'M8.5 8.5h7v7h-7z';

export const CATEGORIES: CategoryDef[] = [
  { label: 'Electronics', icon: 'M8 3h8v18H8zM10.5 18.5h3', mono: '◈' },
  { label: 'Documents', icon: 'M7 3h7l4 4v14H7zM14 3v4.5h4', mono: '▤' },
  { label: 'Clothing', icon: 'M9 3 5.5 6l2 3L9 8v13h6V8l1.5 1 2-3L15 3z', mono: '◇' },
  { label: 'Kitchen', icon: 'M8 3v6a2 2 0 0 0 4 0V3M10 11v10M17 3c1.8 2.6 1.8 5.4 0 8v10', mono: '◫' },
  { label: 'Furniture', icon: 'M5 12V8.5a2 2 0 0 1 4 0V12M15 12V8.5a2 2 0 0 1 4 0V12M4 12h16v6H4zM6.5 18v2.5M17.5 18v2.5', mono: '▣' },
  { label: 'Appliances', icon: 'M5.5 3h13v18h-13zM5.5 8h13M12 11.5a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4', mono: '◍' },
  { label: 'Accessories', icon: 'M9 3h6v3M9 21h6v-3M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12M12 9.5V12l1.8 1.2', mono: '◌' },
  { label: 'Tools', icon: 'M20.5 4.5 17 8M14.5 6.5a4 4 0 1 0 3.2 3.2L20.5 7 18 4.5zM11.8 9.4 4 17.2l2.8 2.8 7.8-7.8', mono: '⌗' },
  { label: 'Medicines', icon: 'M13.5 3.5a5 5 0 0 1 7 7l-10 10a5 5 0 0 1-7-7zM8.5 8.5l7 7', mono: '✚' },
  { label: 'Toys', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c3.2 3 3.2 15 0 18M12 3c-3.2 3-3.2 15 0 18', mono: '◉' },
  { label: 'Sports', icon: 'M7 4h10v3.5a5 5 0 0 1-10 0zM7 5.5H4.5v1.5a3 3 0 0 0 3 3M17 5.5h2.5V7a3 3 0 0 1-3 3M12 12.5V17M8.5 21h7M10 17h4', mono: '◎' },
  { label: 'Personal', icon: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4.5 20.5c0-3.6 3.4-5.5 7.5-5.5s7.5 1.9 7.5 5.5', mono: '◐' },
  { label: 'Other', icon: 'M4 8h16v12H4zM4 8l2-4h12l2 4M12 8v12', mono: '▢' },
];

export const CATEGORY_ICON: Record<string, string> = CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.label]: c.icon }),
  {},
);

export const CATEGORY_MONO: Record<string, string> = CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.label]: c.mono }),
  {},
);
