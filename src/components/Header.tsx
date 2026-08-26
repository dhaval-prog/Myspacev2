import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '../theme';
import { AccountBadge } from './AccountBadge';
import { SearchBar, type SearchSuggestion } from './SearchBar';

interface HeaderProps {
  query: string;
  onChangeQuery: (text: string) => void;
  onAvatarPress?: () => void;
  suggestions?: SearchSuggestion[];
  onSelectSuggestion?: (suggestion: SearchSuggestion) => void;
}

/** Quiet top area: wordmark, integrated search, profile action. */
export function Header({ query, onChangeQuery, onAvatarPress, suggestions, onSelectSuggestion }: HeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={typography.logo}>myspace</Text>
      <SearchBar
        value={query}
        onChangeText={onChangeQuery}
        suggestions={suggestions}
        onSelectSuggestion={onSelectSuggestion}
      />
      <AccountBadge onPress={onAvatarPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
});
