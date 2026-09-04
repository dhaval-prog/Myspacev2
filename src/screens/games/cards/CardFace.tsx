import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { scColor, scFont } from '../../../theme/spaceCardsTokens';
import { WildSwatch } from '../../../components/spacecards/WildSwatch';
import type { CardRank, CardSuit, PlayingCard } from '../../../types/cards';

export const SUIT_COLORS: Record<CardSuit, string> = {
  ember: '#E8533B',
  tide: '#2F93D8',
  moss: '#2F9E4F',
  solar: '#E9B02F',
};

export const SUIT_LABELS: Record<CardSuit, string> = {
  ember: 'Ember',
  tide: 'Tide',
  moss: 'Moss',
  solar: 'Solar',
};

/** Face + corner text for the three coloured action ranks — the handoff spec only covers plain numbers and the wild +4, so these keep readable short labels rather than an invented icon set. */
const SPECIAL_FACE: Record<string, string> = { block: 'BLOCK', flip: 'FLIP', surge2: '+2' };
const SPECIAL_INDEX: Record<string, string> = { block: 'BLK', flip: 'FLP', surge2: '+2' };
const WILD_FACE: Record<string, string> = { prism: 'PRISM', prism4: '+4' };
const WILD_INDEX: Record<string, string> = { prism: 'PR', prism4: '+4' };

function faceText(rank: CardRank, isWild: boolean): string {
  if (isWild) return WILD_FACE[rank] ?? rank;
  return SPECIAL_FACE[rank] ?? rank;
}
function indexText(rank: CardRank, isWild: boolean): string {
  if (isWild) return WILD_INDEX[rank] ?? rank;
  return SPECIAL_INDEX[rank] ?? rank;
}

type CardSize = 'hand' | 'pile' | 'sm';

// `hand` must stay numerically identical to scGeometry.handCard (spaceCardsTokens.ts)
// — the board positions hand cards from that geometry, this renders them at it.
const SIZES: Record<CardSize, { w: number; h: number; radius: number; ovalW: number; ovalH: number; face: number; corner: number }> = {
  hand: { w: 66, h: 96, radius: 13, ovalW: 48, ovalH: 71, face: 26, corner: 11 },
  pile: { w: 80, h: 112, radius: 13, ovalW: 58, ovalH: 82, face: 30, corner: 11 },
  sm: { w: 46, h: 64, radius: 9, ovalW: 33, ovalH: 49, face: 18, corner: 7.5 },
};
/** The wild card's own face size runs smaller than a number's, per the handoff (§3/§5): 15 hand / 20 pile, scaled down again for `sm`. */
const WILD_FACE_SIZE: Record<CardSize, number> = { hand: 17, pile: 20, sm: 12 };
/** A multi-letter special-rank label (BLOCK/FLIP) needs a smaller face size than a single digit to stay on one line. */
const SPECIAL_FACE_SIZE: Record<CardSize, number> = { hand: 15, pile: 17, sm: 10 };

interface CardFaceProps {
  card: PlayingCard;
  size?: CardSize;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * One playing card — exact visual per the Space Cards design handoff: a
 * white card, a colour oval rotated -22deg holding the face value, and a
 * matching mirrored corner index top-left. Wild ranks (prism/prism4) get
 * the four-colour quadrant swatch instead of a solid oval.
 */
export function CardFace({ card, size = 'hand', disabled, onPress, style }: CardFaceProps) {
  const s = SIZES[size];
  const isWild = card.suit === null;
  const solidColour = isWild ? undefined : SUIT_COLORS[card.suit as CardSuit];
  const isSpecial = card.rank === 'block' || card.rank === 'flip' || card.rank === 'surge2';
  const face = faceText(card.rank, isWild);
  const index = indexText(card.rank, isWild);
  const faceSize = isWild ? WILD_FACE_SIZE[size] : isSpecial ? SPECIAL_FACE_SIZE[size] : s.face;
  const cornerColour = isWild ? scColor.ink : solidColour;

  const content = (
    <View style={[styles.card, { width: s.w, height: s.h, borderRadius: s.radius }, disabled && styles.disabled, style]}>
      <View
        style={{
          position: 'absolute',
          left: (s.w - s.ovalW) / 2,
          top: (s.h - s.ovalH) / 2,
          width: s.ovalW,
          height: s.ovalH,
          borderRadius: s.ovalW / 2,
          overflow: 'hidden',
          transform: [{ rotate: '-22deg' }],
        }}
      >
        {isWild ? <WildSwatch style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: solidColour }]} />}
      </View>
      <Text
        style={{
          position: 'absolute',
          left: 2,
          right: 2,
          top: '50%',
          marginTop: -faceSize * 0.56,
          textAlign: 'center',
          fontFamily: scFont.sans800,
          fontSize: faceSize,
          lineHeight: faceSize,
          color: '#FFFFFF',
          textShadowColor: 'rgba(0,0,0,.26)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 0,
        }}
        numberOfLines={1}
      >
        {face}
      </Text>
      <Text style={{ position: 'absolute', left: size === 'pile' ? 7 : 5, top: size === 'pile' ? 6 : 4, fontFamily: scFont.sans800, fontSize: s.corner, lineHeight: s.corner, color: cornerColour }}>
        {index}
      </Text>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${SUIT_LABELS[card.suit as CardSuit] ?? 'Wild'} ${face} card`}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.44,
    shadowOffset: { width: 0, height: 9 },
    shadowRadius: 20,
  },
  disabled: {
    opacity: 0.58,
  },
});
