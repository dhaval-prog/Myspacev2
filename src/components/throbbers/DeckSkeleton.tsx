import React from 'react';
import LottieView from 'lottie-react-native';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/** The real expense/split card's own geometry (see CardStack.tsx) — every skeleton card is proportioned from this, never re-derived. */
const CARD_WIDTH = 326;
const CARD_HEIGHT = 206;
const CARD_RADIUS = 26;

interface SkeletonBarProps {
  width?: number;
}

/** 1F top bar — a lime sweep on a 6%-white track, pinned full-bleed under the header. */
export function SkeletonBar({ width = 340 }: SkeletonBarProps) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <View style={[styles.barTrack, { width }]} accessibilityRole="progressbar" accessibilityLabel="Loading" />;
  }
  return (
    <View style={{ width, height: 3 }} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <LottieView
        source={require('../../../assets/throbbers/throbber-skeleton-bar.json')}
        autoPlay
        loop
        resizeMode="cover"
        style={{ width, height: 3 }}
      />
    </View>
  );
}

interface SkeletonCardProps {
  width?: number;
  /** Stack position behind the focused card — 0 is the top/focused placeholder. Matches CardStack's own depth math exactly. */
  depth?: number;
}

/** One placeholder card at true deck geometry, offset/scaled/faded to sit at `depth` in the stack — reuses CardStack's own d*46-d²*4 / 1-0.06d / 1-0.16d formulas verbatim. */
export function SkeletonCard({ width = CARD_WIDTH, depth = 0 }: SkeletonCardProps) {
  const reduceMotion = useReducedMotion();
  const height = width * (CARD_HEIGHT / CARD_WIDTH);
  const offsetY = depth * 46 - depth * depth * 4;
  const scale = Math.max(0.78, 1 - depth * 0.06);
  const opacity = Math.max(0.5, 1 - depth * 0.16);
  const positionStyle = {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    width,
    height,
    borderRadius: CARD_RADIUS,
    transform: [{ translateY: offsetY }, { scale }],
    opacity,
    zIndex: 40 - depth * 10,
  };

  if (reduceMotion) {
    return <View style={[positionStyle, styles.flatCard]} accessibilityRole="progressbar" accessibilityLabel="Loading" />;
  }
  return (
    <View style={positionStyle} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <LottieView
        source={require('../../../assets/throbbers/throbber-skeleton-card.json')}
        autoPlay
        loop
        style={{ width, height, borderRadius: CARD_RADIUS }}
      />
    </View>
  );
}

interface DeckSkeletonProps {
  width?: number;
  /** Never more than 3 — beyond that the placeholder costs more than it reassures. */
  count?: number;
}

/** Full deck placeholder — the top bar plus a fanned stack of skeleton cards, at the real deck's own geometry. */
export default function DeckSkeleton({ width = CARD_WIDTH, count = 2 }: DeckSkeletonProps) {
  const height = width * (CARD_HEIGHT / CARD_WIDTH);
  return (
    <View style={styles.wrap}>
      <SkeletonBar width={width + 44} />
      <View style={[styles.stackArea, { width, height: height + 46 * Math.max(0, count - 1) }]}>
        {/* Deepest first, so depth 0 renders (and stacks) on top — matches CardStack's own z-order. */}
        {Array.from({ length: count })
          .map((_, i) => i)
          .reverse()
          .map((i) => (
            <SkeletonCard key={i} width={width} depth={i} />
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    gap: 16,
    paddingTop: 16,
  },
  barTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  stackArea: {
    position: 'relative',
  },
  flatCard: {
    backgroundColor: colors.nearBlack,
  },
});
