import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fontFamily, spacing } from '../../theme';
import { useExpenses } from '../../context/ExpensesContext';
import { formatMoney, parseAmount } from '../../utils/expensesFormat';

const CARD_WIDTH = 314;
const CARD_GAP = 14;

/** Horizontal carousel of the deck, starting at the selected card and wrapping around. */
export function WalletCarousel() {
  const { deck, sel, dot, setDot, expensesFor } = useExpenses();

  const ordered = useMemo(() => (deck.length ? [...deck.slice(sel), ...deck.slice(0, sel)] : []), [deck, sel]);

  const handleScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    if (!ordered.length) return;
    const step = CARD_WIDTH + CARD_GAP;
    const i = Math.max(0, Math.min(ordered.length - 1, Math.round(e.nativeEvent.contentOffset.x / step)));
    if (i !== dot) setDot(i);
  };

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={32}
        contentContainerStyle={styles.row}
      >
        {ordered.map((card, i) => {
          const spent = expensesFor(card).reduce((s, x) => s + parseAmount(x.amt), 0);
          const remaining = Math.max(0, parseAmount(card.amount) - spent);
          return (
            <View key={card.rid} style={[styles.card, { backgroundColor: card.bg }]}>
              <View style={[styles.blob, { backgroundColor: 'rgba(255,255,255,.16)' }]} />
              <View style={styles.dotsCorner}>
                <View style={[styles.dotFill, { backgroundColor: card.ink }]} />
                <View style={[styles.dotRing, { borderColor: card.ink }]} />
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.amount, { color: card.ink }]}>{formatMoney(remaining)}</Text>
                <View style={styles.bottomRow}>
                  <View style={{ gap: 4 }}>
                    <Text style={[styles.sub, { color: card.sub }]}>Credit</Text>
                    <Text style={[styles.digits, { color: card.ink }]}>{card.digits}</Text>
                  </View>
                  <View style={{ gap: 4, alignItems: 'flex-end' }}>
                    <Text style={[styles.sub, { color: card.sub }]}>{card.expLabel ?? 'EXP date'}</Text>
                    <Text style={[styles.digits, { color: card.ink }]}>{card.exp}</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.dotsRow}>
        {ordered.map((card, i) => (
          <View key={card.rid} style={[styles.dot, i === dot ? styles.dotActive : styles.dotInactive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: CARD_GAP,
    paddingHorizontal: spacing.xxxl,
  },
  card: {
    width: CARD_WIDTH,
    height: 198,
    borderRadius: 26,
    overflow: 'hidden',
    position: 'relative',
  },
  blob: {
    position: 'absolute',
    left: -30,
    top: -46,
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  dotsCorner: {
    position: 'absolute',
    right: 16,
    top: 16,
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
  cardBody: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 64,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  amount: {
    fontFamily: fontFamily.sans700,
    fontSize: 30,
    letterSpacing: -0.9,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sub: {
    fontFamily: fontFamily.sans400,
    fontSize: 10.5,
  },
  digits: {
    fontFamily: fontFamily.sans500,
    fontSize: 13,
    letterSpacing: 0.78,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  dot: {
    height: 5,
    borderRadius: 999,
  },
  dotActive: {
    width: 16,
    backgroundColor: '#fff',
  },
  dotInactive: {
    width: 5,
    backgroundColor: 'rgba(255,255,255,.32)',
  },
});
