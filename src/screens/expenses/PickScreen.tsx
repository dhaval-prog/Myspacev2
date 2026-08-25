import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { CardStack } from '../../components/expenses/CardStack';
import { WalletBottomNav } from '../../components/expenses/WalletBottomNav';
import { useExpenses } from '../../context/ExpensesContext';

interface PickScreenProps {
  onHome: () => void;
}

/** Scroll through your cards, pull one up (or tap it) to open its wallet. */
export function PickScreen({ onHome }: PickScreenProps) {
  const insets = useSafeAreaInsets();
  const { openNewCard, openSpend } = useExpenses();

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.huge }]}>
        <View style={styles.wordmark}>
          <Text style={styles.sparkle}>✻</Text>
          <Text style={styles.wordmarkText}>myspace</Text>
        </View>
        <Text style={styles.subtitle}>Scroll through your cards · pull one up to open</Text>
      </View>

      <View style={styles.stackArea}>
        <CardStack />
        <Pressable onPress={openNewCard} style={styles.addButton} accessibilityRole="button" accessibilityLabel="Add budget card">
          <Text style={styles.addPlus}>+</Text>
          <Text style={styles.addLabel}>ADD BUDGET CARD</Text>
        </Pressable>
      </View>

      <WalletBottomNav onHome={onHome} onAdd={openSpend} bottomInset={insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.walletBg,
  },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xxxl,
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sparkle: {
    fontSize: 22,
    color: colors.walletTextPrimary,
  },
  wordmarkText: {
    fontFamily: fontFamily.sans600,
    fontSize: 25,
    letterSpacing: -0.5,
    color: colors.walletTextPrimary,
  },
  subtitle: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.walletTextSecondary,
  },
  stackArea: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  addButton: {
    position: 'absolute',
    left: spacing.xxl,
    right: spacing.xxl,
    bottom: 18,
    zIndex: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingVertical: 17,
  },
  addPlus: {
    fontFamily: fontFamily.sans400,
    fontSize: 20,
    color: '#111',
    lineHeight: 20,
  },
  addLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: '#111',
  },
});
