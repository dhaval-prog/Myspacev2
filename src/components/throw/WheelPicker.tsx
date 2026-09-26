import React, { useEffect, useRef } from 'react';
import { Animated, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { throwColor, throwFont } from '../../theme/throwTokens';

export const WHEEL_ITEM_HEIGHT = 34;
const VISIBLE_ROWS = 5;
export const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * VISIBLE_ROWS;
const PAD = (WHEEL_HEIGHT - WHEEL_ITEM_HEIGHT) / 2;

interface WheelPickerProps {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  width?: number;
  accessibilityLabel: string;
}

/**
 * An iOS-style spinning wheel column — one of three placed side by side (hour/minute/AM-PM) for
 * the self-reminder alert's time picker, replacing the old +/- stepper per explicit request to
 * match the reference screenshot. Dependency-free, like the rest of Throw's custom pickers: a
 * plain snapping ScrollView with each row's opacity/scale driven by its own distance from the
 * center (same per-item Animated.interpolate technique RecipientCarousel already uses), rather
 * than a native date/time-picker component. A tap on any visible row also jumps straight to it,
 * both as a UX nicety and so this is fully drivable without a real scroll gesture.
 */
export function WheelPicker({ items, selectedIndex, onChange, width = 56, accessibilityLabel }: WheelPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(selectedIndex * WHEEL_ITEM_HEIGHT)).current;
  // True for the whole span from a drag's first touch to its settle — the effect below that keeps
  // the wheel in sync with an externally-changed `selectedIndex` skips itself while this is set,
  // so it doesn't fight the scroll this same interaction is already driving.
  const interacting = useRef(false);

  useEffect(() => {
    if (interacting.current) return;
    scrollRef.current?.scrollTo({ y: selectedIndex * WHEEL_ITEM_HEIGHT, animated: false });
    scrollY.setValue(selectedIndex * WHEEL_ITEM_HEIGHT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, items.length]);

  const settle = (offsetY: number) => {
    const index = Math.max(0, Math.min(items.length - 1, Math.round(offsetY / WHEEL_ITEM_HEIGHT)));
    scrollRef.current?.scrollTo({ y: index * WHEEL_ITEM_HEIGHT, animated: true });
    interacting.current = false;
    if (index !== selectedIndex) onChange(index);
  };

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false,
    listener: () => {
      interacting.current = true;
    },
  });

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => settle(e.nativeEvent.contentOffset.y);

  const selectItem = (index: number) => {
    interacting.current = false;
    scrollRef.current?.scrollTo({ y: index * WHEEL_ITEM_HEIGHT, animated: true });
    if (index !== selectedIndex) onChange(index);
  };

  return (
    <View style={[styles.wrap, { width }]}>
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: PAD }}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        scrollEventThrottle={16}
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
      >
        {items.map((label, i) => {
          const opacity = scrollY.interpolate({
            inputRange: [(i - 2) * WHEEL_ITEM_HEIGHT, (i - 1) * WHEEL_ITEM_HEIGHT, i * WHEEL_ITEM_HEIGHT, (i + 1) * WHEEL_ITEM_HEIGHT, (i + 2) * WHEEL_ITEM_HEIGHT],
            outputRange: [0.25, 0.55, 1, 0.55, 0.25],
            extrapolate: 'clamp',
          });
          const scale = scrollY.interpolate({
            inputRange: [(i - 1) * WHEEL_ITEM_HEIGHT, i * WHEEL_ITEM_HEIGHT, (i + 1) * WHEEL_ITEM_HEIGHT],
            outputRange: [0.86, 1, 0.86],
            extrapolate: 'clamp',
          });
          return (
            <Pressable
              key={`${label}-${i}`}
              onPress={() => selectItem(i)}
              style={styles.item}
              accessibilityRole="button"
              // Scoped by column ("Hour 9", not just "9") so it stays unambiguous — several
              // columns share overlapping values (e.g. both hour and minute have a "09").
              accessibilityLabel={`${accessibilityLabel} ${label}`}
            >
              <Animated.Text style={[styles.itemLabel, { opacity, transform: [{ scale }] }]}>{label}</Animated.Text>
            </Pressable>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // No selection-band highlight drawn per-column — AlertScheduleHeader draws one shared band
  // across all three columns (hour/minute/period) underneath them, matching the reference
  // screenshot's single continuous pill rather than three separate ones.
  wrap: { height: WHEEL_HEIGHT },
  item: { height: WHEEL_ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { fontFamily: throwFont.ui700, fontSize: 20, color: throwColor.ink },
});
