import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { CardStack } from '../../components/expenses/CardStack';
import { BottomNav } from '../../components/BottomNav';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useExpenses } from '../../context/ExpensesContext';
import { useAuth } from '../../context/AuthContext';

interface PickScreenProps {
  onHome: () => void;
  onOpenSplit: () => void;
}

/** Scroll through your cards, pull one up (or tap it) to open its wallet. */
export function PickScreen({ onHome, onOpenSplit }: PickScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { openNewCard, openJoin } = useExpenses();
  const { signOut } = useAuth();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.huge }]}>
        <Pressable
          onPress={() => setLogoutConfirmOpen(true)}
          style={[styles.accountButton, { top: insets.top + spacing.huge }]}
          accessibilityRole="button"
          accessibilityLabel="Account"
        >
          <Text style={styles.accountIcon}>◎</Text>
        </Pressable>
        <View style={styles.wordmark}>
          <Text style={styles.sparkle}>✻</Text>
          <Text style={styles.wordmarkText}>myspace</Text>
        </View>
        <Text style={styles.subtitle}>Scroll through your cards · pull one up to open</Text>
      </View>

      <View style={styles.stackArea}>
        <CardStack reduceMotion={reduceMotion} />
        <Pressable onPress={openNewCard} style={styles.addButton} accessibilityRole="button" accessibilityLabel="Add budget card">
          <Text style={styles.addPlus}>+</Text>
          <Text style={styles.addLabel}>ADD BUDGET CARD</Text>
        </Pressable>
        <Pressable onPress={openJoin} style={styles.joinLink} accessibilityRole="button" accessibilityLabel="Join a budget card with an invite code">
          <Text style={styles.joinLinkText}>Have an invite code?</Text>
        </Pressable>
      </View>

      <BottomNav
        activeId="expenses"
        onSelect={(id) => {
          if (id === 'home') onHome();
          if (id === 'split') onOpenSplit();
        }}
        onAdd={openNewCard}
        bottomInset={insets.bottom}
        reduceMotion={reduceMotion}
      />

      <ConfirmDialog
        visible={logoutConfirmOpen}
        title="Log out"
        message="Log out of MySpace?"
        confirmLabel="Log out"
        destructive
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          signOut();
        }}
      />
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
    position: 'relative',
  },
  accountButton: {
    position: 'absolute',
    right: spacing.xxxl,
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountIcon: {
    fontSize: 15,
    color: '#fff',
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
  joinLink: {
    position: 'absolute',
    left: spacing.xxl,
    right: spacing.xxl,
    bottom: 84,
    zIndex: 70,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  joinLinkText: {
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    color: 'rgba(255,255,255,.55)',
  },
});
