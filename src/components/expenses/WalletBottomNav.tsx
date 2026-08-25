import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily, spacing } from '../../theme';
import { Icon } from '../Icon';

const ICON = {
  home: 'M4 10.6L12 4.4l8 6.2V19a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19v-8.4z',
  expenses: 'M5 4.5h14v15H5zM8 8.5h8M8 12h8M8 15.5h5',
  piggy: 'M7 6.5h7.5a4.5 4.5 0 0 1 0 9H9l-2.6 3v-3A4.2 4.2 0 0 1 3.4 11 4.5 4.5 0 0 1 7 6.5z',
  split: 'M4 9h11l-3-3M20 15H9l3 3',
  plus: 'M12 6v12M6 12h12',
};

const INACTIVE = 'rgba(17,17,17,.32)';

function NavItem({ icon, label, active, onPress }: { icon: string; label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.item} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label}>
      <Icon path={icon} color={active ? '#111' : INACTIVE} size={22} strokeWidth={active ? 2 : 1.7} />
      <Text style={[styles.label, { color: active ? '#111' : INACTIVE, fontFamily: active ? fontFamily.sans700 : fontFamily.sans500 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

interface WalletBottomNavProps {
  onHome: () => void;
  onAdd: () => void;
  bottomInset: number;
}

/** The white pill nav bar shared by the Pick and Wallet screens. */
export function WalletBottomNav({ onHome, onAdd, bottomInset }: WalletBottomNavProps) {
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(bottomInset, spacing.md) }]}>
      <View style={styles.row}>
        <NavItem icon={ICON.home} label="Home" onPress={onHome} />
        <NavItem icon={ICON.expenses} label="Expenses" active />
        <Pressable onPress={onAdd} style={styles.fab} accessibilityRole="button" accessibilityLabel="Add spend">
          <Icon path={ICON.plus} color="#C3EA4F" size={24} strokeWidth={2.2} />
        </Pressable>
        <NavItem icon={ICON.piggy} label="Piggy" />
        <NavItem icon={ICON.split} label="Split" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.ms,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginHorizontal: 4,
    marginBottom: 8,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
