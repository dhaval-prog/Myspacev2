import React from 'react';
import { View } from 'react-native';
import { CategoryRow } from './CategoryRow';
import type { Category } from '../data/categories';

interface CategoryNavigationProps {
  categories: Category[];
  activeId: string;
  onSelect: (id: string) => void;
  reduceMotion?: boolean;
}

/** Editorial list navigation — the Home screen's three ways in. */
export function CategoryNavigation({ categories, activeId, onSelect, reduceMotion }: CategoryNavigationProps) {
  return (
    <View accessibilityRole="tablist">
      {categories.map((category) => (
        <CategoryRow
          key={category.id}
          count={category.count}
          label={category.label}
          active={category.id === activeId}
          onPress={() => onSelect(category.id)}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}
