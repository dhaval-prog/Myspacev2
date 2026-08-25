/** A card's visual skin — everything about a budget card that isn't user data. */
export interface CardSkin {
  bg: string;
  ink: string;
  sub: string;
  artA: string;
  artB: string;
}

/**
 * The full rotation of card looks. New cards cycle through these in order
 * so a user's deck stays visually varied — no two of their next eight
 * cards repeat a look. A fresh account starts with zero cards; these are
 * only ever applied at creation time, never pre-seeded.
 */
export const CARD_PALETTE: CardSkin[] = [
  {
    bg: '#FFC42E',
    ink: '#111',
    sub: 'rgba(0,0,0,.45)',
    artA: 'rgba(22,104,232,.55)',
    artB: 'rgba(247,244,236,.85)',
  },
  {
    bg: '#F7F4EC',
    ink: '#111',
    sub: 'rgba(0,0,0,.45)',
    artA: 'rgba(246,211,214,.9)',
    artB: 'rgba(22,104,232,.18)',
  },
  {
    bg: '#1668E8',
    ink: '#fff',
    sub: 'rgba(255,255,255,.6)',
    artA: 'rgba(232,53,42,.95)',
    artB: 'rgba(255,255,255,.28)',
  },
  {
    bg: '#E8352A',
    ink: '#fff',
    sub: 'rgba(255,255,255,.62)',
    artA: 'rgba(255,196,46,.95)',
    artB: 'rgba(247,244,236,.5)',
  },
  {
    bg: '#F6D3D6',
    ink: '#111',
    sub: 'rgba(0,0,0,.45)',
    artA: 'rgba(247,244,236,.95)',
    artB: 'rgba(22,104,232,.55)',
  },
  {
    bg: '#0FB271',
    ink: '#fff',
    sub: 'rgba(255,255,255,.62)',
    artA: 'rgba(255,196,46,.9)',
    artB: 'rgba(247,244,236,.45)',
  },
  {
    bg: '#A461F5',
    ink: '#fff',
    sub: 'rgba(255,255,255,.62)',
    artA: 'rgba(247,244,236,.85)',
    artB: 'rgba(22,104,232,.4)',
  },
  {
    bg: '#F5822E',
    ink: '#111',
    sub: 'rgba(0,0,0,.45)',
    artA: 'rgba(247,244,236,.9)',
    artB: 'rgba(232,53,42,.5)',
  },
];

export const RESET_DAY_OPTIONS = ['1st', '15th', 'Last day', 'Custom'];
