export interface ScreenPoint {
  id: string;
  x: number;
  y: number;
}

export interface PinCluster<T extends ScreenPoint> {
  points: T[];
  x: number;
  y: number;
}

/**
 * Greedy single-pass grouping of screen-projected pins within `thresholdPx`
 * of a cluster's first member. Not a true single-linkage clustering (a pin
 * just outside range of the first member but close to a later one stays its
 * own group) — fine at the handful-of-friends scale this map deals with,
 * and cheap enough to recompute every render as the map pans/zooms.
 */
export function clusterPins<T extends ScreenPoint>(points: T[], thresholdPx: number): PinCluster<T>[] {
  const clusters: PinCluster<T>[] = [];
  const used = new Set<string>();

  for (const point of points) {
    if (used.has(point.id)) continue;
    const group: T[] = [point];
    used.add(point.id);

    for (const other of points) {
      if (used.has(other.id)) continue;
      const dx = other.x - point.x;
      const dy = other.y - point.y;
      if (Math.sqrt(dx * dx + dy * dy) <= thresholdPx) {
        group.push(other);
        used.add(other.id);
      }
    }

    const x = group.reduce((sum, p) => sum + p.x, 0) / group.length;
    const y = group.reduce((sum, p) => sum + p.y, 0) / group.length;
    clusters.push({ points: group, x, y });
  }

  return clusters;
}
