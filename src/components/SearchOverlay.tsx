import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, EASE, duration, fontFamily, noOutline, radius, spacing, typography } from '../theme';
import { useGlobalSearch, type SearchResult, type SearchSection } from '../hooks/useGlobalSearch';
import type { Item, Room } from '../types/space';

interface SearchOverlayProps {
  visible: boolean;
  onClose: () => void;
  rooms: Room[];
  items: Item[];
  onOpenHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  reduceMotion?: boolean;
}

const SECTION_LABEL: Record<SearchSection, string> = {
  home: 'Home',
  expenses: 'Expenses',
  split: 'Split',
};

/** Full-screen animated search popup — spans Home's own rooms/items plus Expenses' budget cards and Split's groups. */
export function SearchOverlay({ visible, onClose, rooms, items, onOpenHome, onOpenExpenses, onOpenSplit, reduceMotion }: SearchOverlayProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const results = useGlobalSearch(query, rooms, items);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setQuery('');
      progress.setValue(0);
      Animated.timing(progress, { toValue: 1, duration: reduceMotion ? 0 : duration.state, easing: EASE, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(progress, { toValue: 0, duration: reduceMotion ? 0 : duration.micro, easing: EASE, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) setMounted(false);
        },
      );
    }
    // mounted deliberately excluded — driven by visible, not itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduceMotion, progress]);

  if (!mounted) return null;

  const sections: { key: SearchSection; label: string; results: SearchResult[]; onPress: () => void }[] = [
    { key: 'home', label: SECTION_LABEL.home, results: results.home, onPress: onOpenHome },
    { key: 'expenses', label: SECTION_LABEL.expenses, results: results.expenses, onPress: onOpenExpenses },
    { key: 'split', label: SECTION_LABEL.split, results: results.split, onPress: onOpenSplit },
  ];
  const hasQuery = query.trim().length > 0;
  const totalResults = results.home.length + results.expenses.length + results.split.length;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss search" />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            paddingTop: insets.top + spacing.md,
            opacity: progress,
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
          },
        ]}
      >
        <View style={styles.fieldRow}>
          <Text style={styles.fieldIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search things, spends, splits…"
            placeholderTextColor={colors.placeholder}
            autoFocus
            style={[styles.field, noOutline]}
            accessibilityLabel="Search across Home, Expenses, and Split"
            returnKeyType="search"
          />
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close search" style={styles.closeButton} hitSlop={6}>
            <Text style={styles.closeLabel}>Done</Text>
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.results}>
          {!hasQuery ? (
            <Text style={styles.hint}>Search rooms and items in Home, budget cards in Expenses, and splits in Split.</Text>
          ) : totalResults === 0 ? (
            <Text style={styles.hint}>No matches for "{query.trim()}".</Text>
          ) : (
            sections.map((section) =>
              section.results.length === 0 ? null : (
                <View key={section.key} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.label}</Text>
                  {section.results.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => {
                        onClose();
                        section.onPress();
                      }}
                      style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
                    >
                      <Text style={styles.resultTitle} numberOfLines={1}>
                        {r.title}
                      </Text>
                      <Text style={styles.resultSubtitle} numberOfLines={1}>
                        {r.subtitle}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ),
            )
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(22,33,12,0.35)',
  },
  panel: {
    flex: 1,
    backgroundColor: colors.pale,
    paddingHorizontal: spacing.xxxl,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.ink,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  fieldIcon: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  field: {
    flex: 1,
    padding: 0,
    height: 22,
    ...typography.searchPlaceholder,
    color: colors.textPrimary,
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  closeLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  results: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.huge,
    gap: spacing.xl,
  },
  hint: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textFaint,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontFamily: fontFamily.mono500,
    fontSize: 11.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
  },
  resultRowPressed: {
    backgroundColor: colors.pressWash,
  },
  resultTitle: {
    flexShrink: 1,
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  resultSubtitle: {
    flexShrink: 0,
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.textFaint,
  },
});
