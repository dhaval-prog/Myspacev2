import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useMinimumVisible } from '../../hooks/useMinimumVisible';
import { CardStack } from '../../components/expenses/CardStack';
import { BottomNav } from '../../components/BottomNav';
import { AccountBadge } from '../../components/AccountBadge';
import { NotificationsBell } from '../../components/NotificationsBell';
import { NotificationsSheet } from '../../components/NotificationsSheet';
import { CardFanThrobber } from '../../components/throbbers';
import { useExpenses } from '../../context/ExpensesContext';
import type { NotificationTarget } from '../../utils/notify';

interface PickScreenProps {
  onHome: () => void;
  onOpenSplit: () => void;
  onOpenAccount: () => void;
  onOpenNotificationTarget?: (target: NotificationTarget) => void;
}

/** Scroll through your cards, pull one up (or tap it) to open its wallet. */
export function PickScreen({ onHome, onOpenSplit, onOpenAccount, onOpenNotificationTarget }: PickScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { loading, refreshing, refresh, openNewCard, openJoin } = useExpenses();
  const showLoader = useMinimumVisible(loading, 500);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.huge }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerSpacer}>
            <Image source={require('../../../assets/logos/logo-mono-white.png')} style={styles.logo} />
          </View>
          <View style={styles.headerActions}>
            <NotificationsBell onPress={() => setNotificationsOpen(true)} bg="#111" tint="#fff" />
            <AccountBadge onPress={onOpenAccount} bg="#111" tint="#fff" />
          </View>
        </View>
      </View>

      <View style={styles.stackArea}>
        {showLoader ? (
          <CardFanThrobber size={120} label="Opening your pocket" />
        ) : (
          <>
            <Text style={styles.stackHint} pointerEvents="none">
              Scroll through your cards · pull one up to open
            </Text>
            <CardStack reduceMotion={reduceMotion} refreshing={refreshing} onRefresh={refresh} />
            <Pressable onPress={openNewCard} style={styles.addButton} accessibilityRole="button" accessibilityLabel="Add expense card">
              <Text style={styles.addPlus}>+</Text>
              <Text style={styles.addLabel}>ADD EXPENSE CARD</Text>
            </Pressable>
            <Pressable onPress={openJoin} style={styles.joinLink} accessibilityRole="button" accessibilityLabel="Join a budget card with an invite code">
              <Text style={styles.joinLinkText}>Have an invite code?</Text>
            </Pressable>
          </>
        )}
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

      <NotificationsSheet visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} onNavigate={onOpenNotificationTarget} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.walletBg,
  },
  header: {
    paddingHorizontal: spacing.xxxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerSpacer: {
    width: 100,
    alignItems: 'flex-start',
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
  stackArea: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  stackHint: {
    position: 'absolute',
    top: spacing.md,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.walletTextSecondary,
    opacity: 0.4,
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
