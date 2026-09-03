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

const SPECIAL_INDEX: Record<string, string> = {
  block: 'BLK',
  flip: 'FLP',
  surge2: '+2',
  prism: 'PR',
  prism4: '+4',
};

function faceLabel(rank: CardRank): string {
  return SPECIAL_LABELS[rank] ?? rank;
}

function indexLabel(rank: CardRank): string {
  return SPECIAL_INDEX[rank] ?? rank;
}

interface CardFaceProps {
  card: PlayingCard;
  size?: 'sm' | 'lg';
  disabled?: boolean;
  onPress?: () => void;
}

/**
 * One playing card — an original face (colored body, white center plate,
 * mirrored corner indices) built to feel like a real printed card, not a
 * copy of any specific commercial deck's trade dress.
 */
export function CardFace({ card, size = 'lg', disabled, onPress }: CardFaceProps) {
  const isWild = card.suit === null;
  const bg = isWild ? '#1E1633' : SUIT_COLORS[card.suit as CardSuit];
  const isLg = size === 'lg';
  const dims = isLg ? styles.lg : styles.sm;
  const index = indexLabel(card.rank);

  const content = (
    <View style={[styles.card, dims, { backgroundColor: bg }, disabled && styles.disabled]}>
      <Text style={[styles.index, isLg ? styles.indexLg : styles.indexSm]}>{index}</Text>
      <View style={[styles.plate, isLg ? styles.plateLg : styles.plateSm]}>
        {isWild ? (
          <View style={styles.wheel}>
            {(['ember', 'tide', 'moss', 'solar'] as CardSuit[]).map((s) => (
              <View key={s} style={[styles.wedge, { backgroundColor: SUIT_COLORS[s] }]} />
            ))}
          </View>
        ) : (
          <Text style={[styles.centerText, isLg ? styles.centerTextLg : styles.centerTextSm, { color: bg }]} numberOfLines={1} adjustsFontSizeToFit>
            {index}
          </Text>
        )}
      </View>
      <Text style={[styles.index, styles.indexBottom, isLg ? styles.indexLg : styles.indexSm]}>{index}</Text>
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
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,.55)',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 9,
    elevation: 3,
  },
  lg: { width: 72, height: 100, paddingVertical: 6 },
  sm: { width: 46, height: 64, paddingVertical: 4 },
  disabled: { opacity: 0.35 },
  index: { fontFamily: fontFamily.sans700, color: '#fff', alignSelf: 'flex-start', marginLeft: 6 },
  indexBottom: { alignSelf: 'flex-end', marginRight: 6, transform: [{ rotate: '180deg' }] },
  indexLg: { fontSize: 12.5 },
  indexSm: { fontSize: 9 },
  plate: {
    backgroundColor: '#FBF8F2',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateLg: { width: 52, height: 52 },
  plateSm: { width: 32, height: 32 },
  centerText: { fontFamily: fontFamily.sans800 },
  centerTextLg: { fontSize: 21 },
  centerTextSm: { fontSize: 12 },
  wheel: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  wedge: { width: '50%', height: '50%' },
});
