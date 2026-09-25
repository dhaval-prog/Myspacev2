/**
 * Colors for the web Throw map's day/night MapLibre styles — a separate palette from
 * throwTokens.ts's warm-paper theme (this one has to read as an actual map, not a letter), so it
 * gets its own file per the app's usual per-feature-token convention. Both palettes were sampled
 * directly from user-approved reference screenshots (a Google-style night map and an Apple-Maps-
 * style day flyover) via dominant-color analysis, not eyeballed, then verified live against real
 * OpenFreeMap tiles before being locked in.
 */

// OpenFreeMap (https://openfreemap.org) — free, keyless, no rate limits, explicitly built for
// exactly this kind of Leaflet/Google-Maps-JS migration. `liberty` is its light/day style,
// `dark` its dark style (further recolored below to match the approved night reference).
export const throwMapStyleUrl = {
  day: 'https://tiles.openfreemap.org/styles/liberty',
  night: 'https://tiles.openfreemap.org/styles/dark',
} as const;

export const throwMapDayColor = {
  water: '#a0d8fb',
  park: '#bae6b5',
  building: '#dcdbd6',
} as const;

export const throwMapNightColor = {
  land: '#19253f',
  water: '#224855',
  landuseTint: '#323d6b',
  roadMinor: '#445974',
  roadMajor: '#5b7490',
  roadCasing: 'rgba(15,20,33,0.6)',
  building: '#4a5a86',
} as const;
