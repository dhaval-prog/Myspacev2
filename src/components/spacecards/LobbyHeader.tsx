import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { scFont } from '../../theme/spaceCardsTokens';
import { CardFace } from '../../screens/games/cards/CardFace';
import { Icon } from '../Icon';
import type { PlayingCard } from '../../types/cards';

const BACK_ICON = 'M15 5l-7 7 7 7';

interface FanCard {
  card: PlayingCard;
  rotateDeg: number;
  x: number;
}

interface LobbyHeaderProps {
  title?: string;
  subtitle?: string;
  cards: FanCard[];
  onBack?: () => void;
  reduceMotion?: boolean;
}

/** The dealt-fan hero at the top of Create/Join — same card-fan visual, different deals per screen (§6/§7). 2A carries the screen title; 2B's fan sits alone. The fan gently bobs, like the cards are floating; `onBack` puts navigation in the same row as the title instead of pinned separately below the sheet. */
export function LobbyHeader({ title, subtitle, cards, onBack, reduceMotion }: LobbyHeaderProps) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, bob]);

  const lift = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <View style={styles.wrap}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back to Games">
          <Icon path={BACK_ICON} color="#fff" size={18} strokeWidth={2} />
        </Pressable>
      ) : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={[styles.fan, !title && styles.fanNoTitle]}>
        {cards.map(({ card, rotateDeg, x }, i) => (
          <Animated.View
            key={`${card.suit}-${card.rank}-${i}`}
            style={[styles.fanCard, { marginLeft: x - 40, zIndex: i, transform: [{ rotate: `${rotateDeg}deg` }, { translateY: lift }] }]}
          >
            <CardFace card={card} size="pile" />
          </Animated.View>
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
  backButton: {
    position: 'absolute',
    top: 8,
    left: 22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
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
    marginTop: 46,
  },
  fanCard: {
    position: 'absolute',
  },
});
