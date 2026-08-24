import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography, EASE, duration } from '../theme';
import { Icon } from './Icon';

export interface RailTile {
  id: string;
  mono: string;
  label: string;
  path?: string;
  locked: boolean;
}

interface RailProps {
  tiles: RailTile[];
  activeIndex: number;
  collapsed: boolean;
  onSelect: (index: number) => void;
  onToggleCollapse: () => void;
  reduceMotion?: boolean;
}

const CHEVRON_PATH = 'M6 9.5l6 6 6-6';

/** The notched ice rail — one tile per tool, collapsible via the chevron. */
export function Rail({ tiles, activeIndex, collapsed, onSelect, onToggleCollapse, reduceMotion }: RailProps) {
  const slide = useRef(new Animated.Value(collapsed ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: collapsed ? 1 : 0,
      duration: reduceMotion ? 0 : duration.screen,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  }, [collapsed, slide, reduceMotion]);

  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [0, -152] });
  const opacity = slide.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.toggleNotch}>
        <Pressable
          onPress={onToggleCollapse}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? 'Show tools' : 'Hide tools'}
          style={styles.toggleButton}
        >
          <Animated.View style={{ transform: [{ rotate: collapsed ? '180deg' : '0deg' }] }}>
            <Icon path={CHEVRON_PATH} color={colors.textPrimary} size={22} strokeWidth={2.4} />
          </Animated.View>
        </Pressable>
      </View>

      <Animated.View
        style={[styles.tiles, { transform: [{ translateX }], opacity }]}
        pointerEvents={collapsed ? 'none' : 'auto'}
      >
        {tiles.map((tile, index) => {
          const active = index === activeIndex && !tile.locked;
          return (
            <View key={tile.id} style={styles.notch}>
              <Pressable
                onPress={() => !tile.locked && onSelect(index)}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: tile.locked }}
                accessibilityLabel={tile.label}
                style={[
                  styles.tile,
                  { backgroundColor: tile.locked ? 'rgba(22,33,12,0.04)' : active ? colors.ink : colors.pressWash },
                ]}
              >
                {tile.locked ? (
                  <Text style={styles.lockedGlyph}>⊘</Text>
                ) : tile.path ? (
                  <Icon path={tile.path} color={active ? colors.lime : colors.textPrimary} size={27} strokeWidth={1.7} />
                ) : (
                  <Text style={[styles.monoGlyph, { color: active ? colors.lime : colors.textPrimary }]}>{tile.mono}</Text>
                )}
                <Text style={[typography.railLabel, { color: tile.locked ? colors.textDisabled : active ? colors.lime : colors.textPrimary }]}>
                  {tile.label}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 150,
    zIndex: 10,
    elevation: 10,
  },
  toggleNotch: {
    backgroundColor: colors.pale,
    borderTopRightRadius: 30,
    borderBottomRightRadius: 30,
    marginTop: 26,
    width: 125,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiles: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  notch: {
    backgroundColor: colors.pale,
    borderTopRightRadius: 30,
    borderBottomRightRadius: 30,
    paddingVertical: spacing.md,
    paddingLeft: spacing.xxxl,
    paddingRight: spacing.xxxl,
    alignItems: 'flex-start',
  },
  tile: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xxs + 2,
  },
  monoGlyph: {
    fontFamily: typography.monoBadge.fontFamily,
    fontSize: 30,
  },
  lockedGlyph: {
    fontFamily: typography.monoBadge.fontFamily,
    fontSize: 22,
    color: colors.textDisabled,
  },
});
