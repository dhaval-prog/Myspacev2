interface Point {
  x: number;
  y: number;
}

export interface RoadLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  major: boolean;
}

export interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Fixed screen-pixel spacing rather than anything tied to the projection's lat/lng scale — this
// is what makes the grid self-regulating: a landmass only gets a dense-enough bounding box to
// read as streets once the map is zoomed in a lot (Throw home's "city block" zoom), and naturally
// thins to nothing at full-world zoom (the flight screen), without this needing to know the
// current zoom level at all.
const ROAD_SPACING = 130;
// Below this projected bounding-box area, a landmass reads as a small island/blob, not a place
// with streets — skip it rather than cram a grid into a handful of pixels.
const MIN_GRID_AREA = 26000;
const BUILDING_FILL_CHANCE = 0.6;
const BUILDING_JITTER = ROAD_SPACING * 0.32;
const BUILDING_MIN_SIZE = 5;
const BUILDING_SIZE_RANGE = 9;

function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function boundingBox(points: Point[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * A deterministic street grid + building scatter per landmass, meant to be clipped to that
 * landmass's own silhouette by the caller. Seeded per landmass index so the layout is stable
 * across re-renders at the same zoom rather than reshuffling on every layout pass.
 */
export function buildStreetGrid(landPolygons: Point[][]): { roads: RoadLine[]; buildings: Building[] } {
  const roads: RoadLine[] = [];
  const buildings: Building[] = [];

  landPolygons.forEach((points, landIndex) => {
    const { minX, minY, maxX, maxY } = boundingBox(points);
    const w = maxX - minX;
    const h = maxY - minY;
    if (w * h < MIN_GRID_AREA) return;

    const cols = Math.floor(w / ROAD_SPACING);
    const rows = Math.floor(h / ROAD_SPACING);
    if (cols < 1 || rows < 1) return;

    for (let c = 1; c <= cols; c++) {
      const x = minX + c * ROAD_SPACING;
      roads.push({ x1: x, y1: minY, x2: x, y2: maxY, major: c % 3 === 0 });
    }
    for (let r = 1; r <= rows; r++) {
      const y = minY + r * ROAD_SPACING;
      roads.push({ x1: minX, y1: y, x2: maxX, y2: y, major: r % 3 === 0 });
    }

    const random = mulberry32(landIndex * 7919 + 11);
    for (let c = 0; c <= cols; c++) {
      for (let r = 0; r <= rows; r++) {
        if (random() > BUILDING_FILL_CHANCE) continue;
        const cellCx = minX + c * ROAD_SPACING + ROAD_SPACING / 2;
        const cellCy = minY + r * ROAD_SPACING + ROAD_SPACING / 2;
        const cx = cellCx + (random() - 0.5) * BUILDING_JITTER;
        const cy = cellCy + (random() - 0.5) * BUILDING_JITTER;
        const w2 = BUILDING_MIN_SIZE + random() * BUILDING_SIZE_RANGE;
        const h2 = BUILDING_MIN_SIZE + random() * BUILDING_SIZE_RANGE;
        buildings.push({ x: cx - w2 / 2, y: cy - h2 / 2, w: w2, h: h2 });
      }
    }
  });

  return { roads, buildings };
}
