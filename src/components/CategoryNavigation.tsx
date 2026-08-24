import React from 'react';
import { View } from 'react-native';
import { CategoryRow } from './CategoryRow';

export interface CategoryRowData {
  id: string;
  label: string;
  count: string;
  locked?: boolean;
}

interface CategoryNavigationProps {
  rows: CategoryRowData[];
  activeId: string;
  onSelect: (id: string) => void;
  reduceMotion?: boolean;
}

/** Editorial list navigation — the Home screen's ways in. */
export function CategoryNavigation({ rows, activeId, onSelect, reduceMotion }: CategoryNavigationProps) {
  return (
    <View accessibilityRole="tablist">
      {rows.map((row) => (
        <CategoryRow
          key={row.id}
          count={row.count}
          label={row.label}
          active={row.id === activeId}
          locked={row.locked}
          onPress={() => onSelect(row.id)}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}
