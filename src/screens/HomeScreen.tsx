import React, { useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { categories } from '../data/categories';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { Header } from '../components/Header';
import { Hero } from '../components/Hero';
import { CategoryNavigation } from '../components/CategoryNavigation';
import { ContextCard } from '../components/ContextCard';
import { BottomNavigation } from '../components/BottomNavigation';

/**
 * MySpace V2 — Home.
 * Layered composition: lime background → quiet header → editorial hero →
 * pale content surface (organic top-left corner) holding the category
 * navigation, the context card, and the bottom navigation.
 */
export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0].id);
  const [activeNavId, setActiveNavId] = useState('home');

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === activeCategoryId) ?? categories[0],
    [activeCategoryId],
  );
  const selectedItem = activeCategory.items[0];

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.lime} />

      <View style={{ paddingTop: insets.top + spacing.md }}>
        <View style={styles.headerPad}>
          <Header query={query} onChangeQuery={setQuery} />
        </View>
        <Hero line={activeCategory.heroLine} reduceMotion={reduceMotion} />
      </View>

      <View style={styles.surface}>
        <ScrollView
          style={styles.rows}
          contentContainerStyle={styles.rowsContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <CategoryNavigation
            categories={categories}
            activeId={activeCategoryId}
            onSelect={setActiveCategoryId}
            reduceMotion={reduceMotion}
          />
        </ScrollView>

        <ContextCard label={activeCategory.label} title={selectedItem.title} reduceMotion={reduceMotion} />

        <BottomNavigation
          activeId={activeNavId}
          onSelect={setActiveNavId}
          bottomInset={insets.bottom}
          reduceMotion={reduceMotion}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.lime,
  },
  headerPad: {
    paddingHorizontal: spacing.xxxl,
  },
  surface: {
    flex: 1,
    marginTop: spacing.xxxl,
    backgroundColor: colors.pale,
    borderTopLeftRadius: radius.organic,
  },
  rows: {
    flex: 1,
  },
  rowsContent: {
    paddingTop: spacing.md,
    flexGrow: 1,
  },
});
