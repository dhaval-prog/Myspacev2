import type { WalletCard } from '../types/expenses';

const mask = (rid: string) => `*** **** ${rid.slice(7)}`;

/** The five starter budget cards every account opens with. */
export function seedDeck(): WalletCard[] {
  return [
    {
      label: 'Everyday',
      bg: '#FFC42E',
      ink: '#111',
      sub: 'rgba(0,0,0,.45)',
      amount: '₹ 2,834',
      rid: '27650334808',
      digits: mask('27650334808'),
      exp: '04 / 26',
      artA: 'rgba(22,104,232,.55)',
      artB: 'rgba(247,244,236,.85)',
    },
    {
      label: 'Savings',
      bg: '#F7F4EC',
      ink: '#111',
      sub: 'rgba(0,0,0,.45)',
      amount: '₹ 1,234',
      rid: '41908276512',
      digits: mask('41908276512'),
      exp: '03 / 26',
      artA: 'rgba(246,211,214,.9)',
      artB: 'rgba(22,104,232,.18)',
    },
    {
      label: 'Shared',
      bg: '#1668E8',
      ink: '#fff',
      sub: 'rgba(255,255,255,.6)',
      amount: '₹ 802',
      rid: '63472018904',
      digits: mask('63472018904'),
      exp: '05 / 27',
      artA: 'rgba(232,53,42,.95)',
      artB: 'rgba(255,255,255,.28)',
    },
    {
      label: 'Travel',
      bg: '#E8352A',
      ink: '#fff',
      sub: 'rgba(255,255,255,.62)',
      amount: '₹ 486',
      rid: '58210947336',
      digits: mask('58210947336'),
      exp: '09 / 27',
      artA: 'rgba(255,196,46,.95)',
      artB: 'rgba(247,244,236,.5)',
    },
    {
      label: 'Home',
      bg: '#F6D3D6',
      ink: '#111',
      sub: 'rgba(0,0,0,.45)',
      amount: '₹ 1,940',
      rid: '19073465120',
      digits: mask('19073465120'),
      exp: '11 / 26',
      artA: 'rgba(247,244,236,.95)',
      artB: 'rgba(22,104,232,.55)',
    },
  ];
}

/** Colors cycled for cards the user creates. */
export const NEW_CARD_PALETTE = [
  { bg: '#0FB271', ink: '#fff', sub: 'rgba(255,255,255,.62)', artA: 'rgba(255,196,46,.9)', artB: 'rgba(247,244,236,.45)' },
  { bg: '#A461F5', ink: '#fff', sub: 'rgba(255,255,255,.62)', artA: 'rgba(247,244,236,.85)', artB: 'rgba(22,104,232,.4)' },
  { bg: '#F5822E', ink: '#111', sub: 'rgba(0,0,0,.45)', artA: 'rgba(247,244,236,.9)', artB: 'rgba(232,53,42,.5)' },
];

export const RESET_DAY_OPTIONS = ['1st', '15th', 'Last day', 'Custom'];
