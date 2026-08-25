import React, { useState } from 'react';
import {
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { fontFamily } from '../../theme';
import { useExpenses } from '../../context/ExpensesContext';
import { formatMoney, parseAmount } from '../../utils/expensesFormat';

const CARD_WIDTH = 326;
const CARD_HEIGHT = 206;
const SLOT_HEIGHT = 132;
const OPEN_THRESHOLD = -64;

/**
 * The card-browsing deck: scroll through an invisible tall list to fan
 * through the cards, drag the front card up (or tap it) to open its
 * wallet. Styles are computed per-frame from plain state, mirroring how
 * the reference itself drives this (imperative JS math, not CSS
 * transitions) rather than trying to force it through Animated nodes.
 */
export function CardStack() {
  const { deck, flyCard, openCard, expensesFor } = useExpenses();
  const [pickP, setPickP] = useState(0);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const moved = React.useRef(0);

  const n = Math.max(1, deck.length);

  const handleScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const p = Math.max(0, Math.min(n - 1, e.nativeEvent.contentOffset.y / SLOT_HEIGHT));
    setPickP(p);
  };

  const panResponderFor = (index: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        moved.current = 0;
        setDragIdx(index);
        setDragY(0);
      },
      onPanResponderMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        moved.current = Math.abs(g.dy);
        setDragY(Math.max(-190, Math.min(40, g.dy)));
      },
      onPanResponderRelease: (_e, g: PanResponderGestureState) => {
        setDragIdx(null);
        const finalDragY = Math.max(-190, Math.min(40, g.dy));
        setDragY(0);
        if (moved.current < 6 || finalDragY < OPEN_THRESHOLD) openCard(index);
      },
      onPanResponderTerminate: () => {
        setDragIdx(null);
        setDragY(0);
      },
    });

  return (
    <View style={styles.area}>
      <ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ paddingBottom: 84 }}
        showsVerticalScrollIndicator={false}
      >
        {deck.map((card) => (
          <View key={card.rid} style={{ height: SLOT_HEIGHT }} />
        ))}
        <View style={{ height: 300 }} />
      </ScrollView>

      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
          {deck.map((card, i) => {
            const d = i - pickP;
            const ad = Math.min(3, Math.abs(d));
            const focused = ad < 0.5;
            const flying = flyCard === i;
            const held = dragIdx === i;
            const baseY = d >= 0 ? d * 46 - ad * ad * 4 : d * 62;
            const scale = flying ? 1.06 : Math.max(0.78, 1 - ad * 0.06);
            const opacity = flying ? 1 : Math.max(0.5, 1 - ad * 0.16);
            const spent = expensesFor(card).reduce((s, x) => s + parseAmount(x.amt), 0);
            const remaining = Math.max(0, parseAmount(card.amount) - spent);
            const translateY = flying ? -190 : baseY + (held ? dragY : 0);
            const responder = focused || held ? panResponderFor(i) : null;

            return (
              <View
                key={card.rid}
                {...(responder ? responder.panHandlers : {})}
                style={[
                  styles.card,
                  {
                    backgroundColor: card.bg,
                    zIndex: flying || held ? 60 : Math.round(40 - ad * 10),
                    opacity,
                    transform: [{ translateY }, { scale: flying ? 1.06 : scale }],
                  },
                ]}
              >
                <View style={[styles.blobA, { backgroundColor: card.artA }]} />
                <View style={[styles.blobB, { backgroundColor: card.artB }]} />
                <View style={styles.headerRow}>
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={[styles.label, { color: card.sub, opacity: focused ? 1 : 0 }]} numberOfLines={1}>
                      {card.label.toUpperCase()}
                    </Text>
                    <Text style={[styles.amount, { color: card.ink, opacity: focused ? 1 : 0 }]} numberOfLines={1}>
                      {formatMoney(remaining)}
                    </Text>
                  </View>
                  <View style={styles.dots}>
                    <View style={[styles.dotFill, { backgroundColor: card.ink }]} />
                    <View style={[styles.dotRing, { borderColor: card.ink }]} />
                  </View>
                </View>
                <Text style={[styles.digits, { color: card.ink, opacity: focused ? 1 : 0 }]}>{card.digits}</Text>
                <Text style={[styles.reset, { color: card.sub, opacity: focused ? 1 : 0 }]}>{card.exp}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  centerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: CARD_HEIGHT,
    borderRadius: 26,
    overflow: 'hidden',
  },
  blobA: {
    position: 'absolute',
    right: -34,
    top: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  blobB: {
    position: 'absolute',
    right: 16,
    bottom: -52,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  headerRow: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  label: {
    fontSize: 12,
    letterSpacing: 1.68,
    fontFamily: fontFamily.sans500,
  },
  amount: {
    fontSize: 26,
    letterSpacing: -0.78,
    fontFamily: fontFamily.sans700,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotFill: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  dotRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.6,
    marginLeft: -9,
  },
  digits: {
    position: 'absolute',
    left: 20,
    bottom: 18,
    fontSize: 13,
    letterSpacing: 0.78,
    fontFamily: fontFamily.sans500,
  },
  reset: {
    position: 'absolute',
    right: 20,
    bottom: 18,
    fontSize: 13,
    letterSpacing: 0.52,
    fontFamily: fontFamily.sans500,
  },
});
