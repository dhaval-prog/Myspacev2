/**
 * A decorative, deterministic "QR-like" pattern seeded from a card's id —
 * not a real scannable code, just a believable visual seeded so the same
 * card always renders the same pattern.
 */
const GRID = 21;

export function generateQrCells(seedSource: string): boolean[] {
  const seed =
    seedSource
      .split('')
      .reduce((acc, d) => acc * 31 + Number(d || 0), 7) || 7;
  let x = seed;
  const rnd = () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };

  const inBox = (r: number, k: number, r0: number, k0: number) => r >= r0 && r < r0 + 7 && k >= k0 && k < k0 + 7;
  const ring = (r: number, k: number, r0: number, k0: number) => {
    const dr = r - r0;
    const dk = k - k0;
    const edge = dr === 0 || dr === 6 || dk === 0 || dk === 6;
    const core = dr >= 2 && dr <= 4 && dk >= 2 && dk <= 4;
    return edge || core;
  };
  const finder = (r: number, k: number): -1 | 0 | 1 => {
    if (inBox(r, k, 0, 0)) return ring(r, k, 0, 0) ? 1 : 0;
    if (inBox(r, k, 0, GRID - 7)) return ring(r, k, 0, GRID - 7) ? 1 : 0;
    if (inBox(r, k, GRID - 7, 0)) return ring(r, k, GRID - 7, 0) ? 1 : 0;
    return -1;
  };

  const cells: boolean[] = [];
  for (let r = 0; r < GRID; r++) {
    for (let k = 0; k < GRID; k++) {
      const f = finder(r, k);
      cells.push(f === -1 ? rnd() > 0.5 : f === 1);
    }
  }
  return cells;
}

export const QR_GRID_SIZE = GRID;
