export interface SpotIconDef {
  label: string;
  icon: string;
}

/** Icon presets offered when adding a planned spot to a trip map. */
export const SPOT_ICONS: SpotIconDef[] = [
  { label: 'Beach', icon: 'M12 3.5v17M5 20.5h14M4 11.5c1.6-4.5 4.4-6.6 8-6.6s6.4 2.1 8 6.6c-2.4-1.6-4.7-1.6-7 0-2.6-1.7-5.3-1.7-9 0z' },
  { label: 'Food', icon: 'M7 3.5v8M4.5 3.5v4a2.5 2.5 0 0 0 5 0v-4M7 11.5v9M16.5 3.5c-1.6 1.2-2.4 3-2.4 5.2 0 1.6.8 2.6 2.4 2.8v9' },
  { label: 'Stay', icon: 'M4 19v-9l8-5 8 5v9M9.5 19v-5h5v5' },
  { label: 'Activity', icon: 'M12 21s-7-4.35-9.5-8.5C.7 9 2 5.5 5.5 5c2-.3 3.7.9 4.5 2 .8-1.1 2.5-2.3 4.5-2 3.5.5 4.8 4 3 7.5C19 16.65 12 21 12 21z' },
  { label: 'Shopping', icon: 'M4 5h2.2l2.3 9.4h8.6L19 8H7M9.5 19.4a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2M16.5 19.4a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2' },
  { label: 'Other', icon: 'M5 12h.01M12 12h.01M19 12h.01' },
];

export const SPOT_ICON_MAP: Record<string, string> = SPOT_ICONS.reduce((acc, c) => ({ ...acc, [c.label]: c.icon }), {});
export const SPOT_ICON_DEFAULT = SPOT_ICONS[SPOT_ICONS.length - 1].icon;
