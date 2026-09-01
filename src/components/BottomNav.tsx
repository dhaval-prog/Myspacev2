import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily, spacing, EASE, duration } from '../theme';
import { Icon } from './Icon';
import { navItems } from '../data/navItems';

const INACTIVE = 'rgba(255,255,255,.45)';
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
        <Icon path={path} color={active ? '#fff' : INACTIVE} size={20} strokeWidth={active ? 2 : 1.7} />
        <Text style={[styles.label, { color: active ? '#fff' : INACTIVE, fontFamily: active ? fontFamily.sans700 : fontFamily.sans500 }]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const FAB_ICON_DEFAULT = '#C3EA4F';
const FAB_ICON_BY_TAB: Record<string, string> = {
  expenses: '#fff',
  split: '#DE3769',
};

function Fab({
  onPress,
  reduceMotion,
  activeId,
  iconPath,
  accessibilityLabel,
}: {
  onPress?: () => void;
  reduceMotion?: boolean;
  activeId: string;
  iconPath: string;
  accessibilityLabel: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animateTo = (v: number, dur: number) =>
    Animated.timing(scale, { toValue: v, duration: reduceMotion ? 0 : dur, easing: EASE, useNativeDriver: true }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(0.92, duration.micro)}
      onPressOut={() => animateTo(1, duration.state)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
    >
      <Animated.View style={[styles.fab, { transform: [{ scale }] }]}>
        <Icon path={iconPath} color={FAB_ICON_BY_TAB[activeId] ?? FAB_ICON_DEFAULT} size={24} strokeWidth={2.2} />
      </Animated.View>
    </Pressable>
  );
}

interface BottomNavProps {
  activeId: string;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  /** Overrides the right-hand circle's icon/label — e.g. Chats, Back, or Add-a-friend on the Friends flow instead of the default "+". */
  fabIconPath?: string;
  fabAccessibilityLabel?: string;
  bottomInset: number;
  reduceMotion?: boolean;
}

/**
 * Floating nav dock shared by every screen (Home, Expenses, Split): a dark
 * pill grouping Home/Expenses/Split on the left, and a separate circular
 * "+" action to its right — two distinct floating shapes, not one bar.
 */
export function BottomNav({ activeId, onSelect, onAdd, fabIconPath, fabAccessibilityLabel, bottomInset, reduceMotion }: BottomNavProps) {
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(bottomInset, spacing.md) }]}>
      <View style={styles.row}>
        <View style={styles.pill}>
          {navItems.map((item) => (
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
        <Fab
          onPress={onAdd}
          reduceMotion={reduceMotion}
          activeId={activeId}
          iconPath={fabIconPath ?? PLUS_PATH}
          accessibilityLabel={fabAccessibilityLabel ?? 'Add'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,17,0.92)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 6,
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
    gap: 4,
  },
  label: {
    fontSize: 10.5,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(17,17,17,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
