import { colors } from '../theme';

export interface AvatarSkin {
  bg: string;
  fg: string;
  border?: string;
}

/** The three-color rotation used for every friend/chat avatar — lime, ice, coral. */
const PALETTE: AvatarSkin[] = [
  { bg: colors.lime, fg: colors.ink },
  { bg: colors.pale, fg: colors.ink, border: colors.divider },
  { bg: colors.coral, fg: '#fff' },
];

export function avatarSkinFor(userId: string): AvatarSkin {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || '??';
}
