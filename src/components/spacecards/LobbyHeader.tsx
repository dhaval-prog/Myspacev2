import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { scFont } from '../../theme/spaceCardsTokens';
import { CardFace } from '../../screens/games/cards/CardFace';
import type { PlayingCard } from '../../types/cards';

interface FanCard {
  card: PlayingCard;
  rotateDeg: number;
  x: number;
}

interface LobbyHeaderProps {
  title?: string;
  subtitle?: string;
  cards: FanCard[];
}

/** The dealt-fan hero at the top of Create/Join — same card-fan visual, different deals per screen (§6/§7). 2A carries the screen title; 2B's fan sits alone. */
export function LobbyHeader({ title, subtitle, cards }: LobbyHeaderProps) {
  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={[styles.fan, !title && styles.fanNoTitle]}>
        {cards.map(({ card, rotateDeg, x }, i) => (
          <CardFace
            key={`${card.suit}-${card.rank}-${i}`}
            card={card}
            size="pile"
            style={[styles.fanCard, { marginLeft: x - 40, zIndex: i, transform: [{ rotate: `${rotateDeg}deg` }] }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 22,
    paddingTop: 8,
    alignItems: 'center',
  },
  title: {
    alignSelf: 'flex-start',
    fontFamily: scFont.sans800,
    fontSize: 28,
    lineHeight: 30.8,
    letterSpacing: -1,
    color: '#FFFFFF',
  },
  subtitle: {
    alignSelf: 'flex-start',
    fontFamily: scFont.sans400,
    fontSize: 12.5,
    lineHeight: 18.1,
    color: 'rgba(255,255,255,.58)',
    marginTop: 4,
  },
  fan: {
    flexDirection: 'row',
    marginTop: 26,
    marginBottom: 8,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fanNoTitle: {
    marginTop: 40,
  },
  fanCard: {
    position: 'absolute',
  },
});
