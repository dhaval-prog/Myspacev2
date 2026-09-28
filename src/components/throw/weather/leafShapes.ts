/** Six distinct leaf silhouettes (viewBox `0 0 24 24`), not one shape scaled six ways — per this
 * feature's own explicit "do not use simple circles or generic triangles" / "several natural leaf
 * silhouettes" requirement. Each is a simple two-bezier pointed-oval, varied in proportion/
 * asymmetry to read as a genuinely different leaf rather than the same glyph resized. */
export const LEAF_SHAPES = [
  // Small — compact, rounded.
  'M12 4C15 6 17 9 16 13C15 17 13 19 12 20C11 19 9 17 8 13C7 9 9 6 12 4Z',
  // Medium — the standard almond-ish leaf.
  'M12 2C16 6 19 10 17 15C15 19 13 21 12 22C11 21 9 19 7 15C5 10 8 6 12 2Z',
  // Large — broader, rounder.
  'M12 2C18 5 21 11 18 16C15 21 13 23 12 24C11 23 9 21 6 16C3 11 6 5 12 2Z',
  // Slightly curled — asymmetric, one edge pulled in toward the midrib.
  'M12 2C17 5 20 9 16 13C19 17 15 21 12 22C10 20 6 18 7 13C4 9 8 5 12 2Z',
  // Thin — narrow and elongated, willow-like.
  'M12 1C14 5 15 11 14 17C13 21 12.5 23 12 24C11.5 23 11 21 10 17C9 11 10 5 12 1Z',
  // Broad — wide and short.
  'M12 5C17 6 20 9 19 12C18 16 15 18 12 19C9 18 6 16 5 12C4 9 7 6 12 5Z',
] as const;

/** Muted, natural tones only — no saturated/bright colors (per explicit request) — a mix of
 * greens, olives, and dry golds/browns reading as real foliage rather than a flat brand palette. */
export const LEAF_COLORS = [
  '#6B8E4E',
  '#7C9A5C',
  '#8FA66B',
  '#A98B4C',
  '#B08968',
  '#9C7A3C',
  '#6F7D4A',
  '#C2A45E',
] as const;
