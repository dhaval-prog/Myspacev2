import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily, radius } from '../../../theme';
import type { CardRank, CardSuit, PlayingCard } from '../../../types/cards';

export const SUIT_COLORS: Record<CardSuit, string> = {
  ember: '#E8543A',
  tide: '#2C8FC9',
  moss: '#3F8F4F',
  solar: '#E8A93D',
};

export const SUIT_LABELS: Record<CardSuit, string> = {
  ember: 'Ember',
  tide: 'Tide',
  moss: 'Moss',
  solar: 'Solar',
};

const SPECIAL_LABELS: Record<string, string> = {
  block: 'BLOCK',
  flip: 'FLIP',
  surge2: '+2',
  prism: 'PRISM',
  prism4: '+4',
};

function faceLabel(rank: CardRank): string {
  return SPECIAL_LABELS[rank] ?? rank;
}

interface CardFaceProps {
  card: PlayingCard;
  size?: 'sm' | 'lg';
  disabled?: boolean;
  onPress?: () => void;
}

/** One playing card — the only place suit colors/labels are drawn from. */
export function CardFace({ card, size = 'lg', disabled, onPress }: CardFaceProps) {
  const isWild = card.suit === null;
  const bg = isWild ? '#241A3D' : SUIT_COLORS[card.suit as CardSuit];
  const dims = size === 'lg' ? styles.lg : styles.sm;

  const content = (
    <View style={[styles.card, dims, { backgroundColor: bg }, disabled && styles.disabled]}>
      <Text style={[styles.rankText, size === 'sm' && styles.rankTextSm]} numberOfLines={1} adjustsFontSizeToFit>
        {faceLabel(card.rank)}
      </Text>
      {isWild && (
        <View style={styles.wildDots}>
          {(['ember', 'tide', 'moss', 'solar'] as CardSuit[]).map((s) => (
            <View key={s} style={[styles.dot, { backgroundColor: SUIT_COLORS[s] }]} />
          ))}
        </View>
      )}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${faceLabel(card.rank)} card`}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  lg: { width: 68, height: 96, padding: 6 },
  sm: { width: 44, height: 62, padding: 4 },
  disabled: { opacity: 0.35 },
  rankText: { fontFamily: fontFamily.sans700, fontSize: 26, color: '#fff' },
  rankTextSm: { fontSize: 16 },
  wildDots: { flexDirection: 'row', gap: 3, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
