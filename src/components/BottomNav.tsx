import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily, spacing, EASE, duration } from '../theme';
import { Icon } from './Icon';
import { navItems } from '../data/navItems';

const INACTIVE = 'rgba(17,17,17,.32)';
const PLUS_PATH = 'M12 6v12M6 12h12';

function NavButton({
  path,
  label,
  active,
  onPress,
  reduceMotion,
}: {
  path: string;
  label: string;
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
      accessibilityLabel={label}
      style={styles.item}
      hitSlop={6}
    >
      <Animated.View style={[styles.itemInner, { transform: [{ scale }] }]}>
        <Icon path={path} color={active ? '#111' : INACTIVE} size={22} strokeWidth={active ? 2 : 1.7} />
        <Text style={[styles.label, { color: active ? '#111' : INACTIVE, fontFamily: active ? fontFamily.sans700 : fontFamily.sans500 }]}>
          {label}
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
        <Icon path={PLUS_PATH} color="#C3EA4F" size={24} strokeWidth={2.2} />
      </Animated.View>
    </Pressable>
  );
}

interface BottomNavProps {
  activeId: string;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  bottomInset: number;
  reduceMotion?: boolean;
}

/** The white pill nav bar shared by every screen (Home, Expenses). */
export function BottomNav({ activeId, onSelect, onAdd, bottomInset, reduceMotion }: BottomNavProps) {
  const left = navItems.filter((n) => n.align === 'left');
  const right = navItems.filter((n) => n.align === 'right');

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(bottomInset, spacing.md) }]}>
      <View style={styles.row}>
        {left.map((item) => (
          <NavButton
            key={item.id}
            path={item.icon}
            label={item.label}
            active={item.id === activeId}
            onPress={() => onSelect(item.id)}
            reduceMotion={reduceMotion}
          />
        ))}
        <Fab onPress={onAdd} reduceMotion={reduceMotion} />
        {right.map((item) => (
          <NavButton
            key={item.id}
            path={item.icon}
            label={item.label}
            active={item.id === activeId}
            onPress={() => onSelect(item.id)}
            reduceMotion={reduceMotion}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.ms,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  item: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInner: {
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 12,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginHorizontal: 4,
    marginBottom: 8,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
