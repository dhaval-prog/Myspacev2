/**
 * Flight-path math for the Received Letters screen's plane animation — ported verbatim from the
 * design handoff's own `Component` class (`ease`/`bez`/`dbez`). This is screen-space pixel math
 * for the plane glyph itself (which flies over the letter card/chip row, not over real geography),
 * distinct from `mapProjection.ts`'s lat/lng flight math used by the map underneath.
 */

export interface Point {
  x: number;
  y: number;
}

/** easeInOutCubic. */
export function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Cubic bezier position at t, for one axis. */
export function bez(a: number, b: number, c: number, d: number, t: number): number {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

/** Cubic bezier derivative (tangent) at t, for one axis — used to orient the plane along its path. */
export function dbez(a: number, b: number, c: number, d: number, t: number): number {
  const u = 1 - t;
  return 3 * u * u * (b - a) + 6 * u * t * (c - b) + 3 * t * t * (d - c);
}

/** Position + heading (degrees, plane-icon convention: +22° offset to match its own drawn tilt) along a cubic bezier at t. */
export function bezierPointAndHeading(p: [Point, Point, Point, Point], t: number): { point: Point; headingDeg: number } {
  const x = bez(p[0].x, p[1].x, p[2].x, p[3].x, t);
  const y = bez(p[0].y, p[1].y, p[2].y, p[3].y, t);
  const dx = dbez(p[0].x, p[1].x, p[2].x, p[3].x, t);
  const dy = dbez(p[0].y, p[1].y, p[2].y, p[3].y, t);
  const headingDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 22;
  return { point: { x, y }, headingDeg };
}

/** "1,180 MI" — compact, for the postmark stamp / chip labels (too small for formatMiles' full "miles" word). */
export function compactMiles(miles: number): string {
  return `${Math.round(miles).toLocaleString('en-US')} MI`;
}
