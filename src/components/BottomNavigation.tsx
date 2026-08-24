import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography, fontFamily, EASE, duration } from '../theme';
import { navItems, type NavItem } from '../data/navItems';

interface BottomNavigationProps {
  activeId: string;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  bottomInset: number;
  reduceMotion?: boolean;
}

function NavButton({
  item,
  active,
  onPress,
  reduceMotion,
}: {
  item: NavItem;
  active: boolean;
  onPress: () => void;
  reduceMotion?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animateTo = (v: number, dur: number) =>
    Animated.timing(scale, { toValue: v, duration: reduceMotion ? 0 : dur, easing: EASE, useNativeDriver: true }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(0.9, duration.micro)}
      onPressOut={() => animateTo(1, duration.state)}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.label}
      style={styles.navItem}
      hitSlop={6}
    >
      <Animated.View style={[styles.navItemInner, { transform: [{ scale }] }]}>
        <Text style={[styles.icon, { color: active ? colors.textPrimary : colors.textDisabled }]}>
          {item.icon}
        </Text>
        <Text style={[typography.navLabel, { color: active ? colors.textPrimary : colors.textDisabled }]}>
          {item.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function Fab({ onPress, reduceMotion }: { onPress?: () => void; reduceMotion?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animateTo = (v: number, dur: number) =>
    Animated.timing(scale, { toValue: v, duration: reduceMotion ? 0 : dur, easing: EASE, useNativeDriver: true }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(0.92, duration.micro)}
      onPressOut={() => animateTo(1, duration.state)}
      accessibilityRole="button"
      accessibilityLabel="Add"
      hitSlop={6}
    >
      <Animated.View style={[styles.fab, { transform: [{ scale }] }]}>
        <Text style={styles.fabIcon}>+</Text>
      </Animated.View>
    </Pressable>
  );
}

/** Mobile-friendly navigation bar, integrated into the MySpace visual language. */
export function BottomNavigation({ activeId, onSelect, onAdd, bottomInset, reduceMotion }: BottomNavigationProps) {
  const left = navItems.filter((n) => n.align === 'left');
  const right = navItems.filter((n) => n.align === 'right');

  return (
    <View style={[styles.row, { paddingBottom: Math.max(bottomInset, spacing.huge) }]}>
      {left.map((item) => (
        <NavButton
          key={item.id}
          item={item}
          active={item.id === activeId}
          onPress={() => onSelect(item.id)}
          reduceMotion={reduceMotion}
        />
      ))}
      <Fab onPress={onAdd} reduceMotion={reduceMotion} />
      {right.map((item) => (
        <NavButton
          key={item.id}
          item={item}
          active={item.id === activeId}
          onPress={() => onSelect(item.id)}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.huge,
  },
  navItem: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemInner: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  icon: {
    fontSize: 17,
  },
  fab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    fontSize: 22,
    color: colors.lime,
    fontFamily: fontFamily.sans600,
  },
});
