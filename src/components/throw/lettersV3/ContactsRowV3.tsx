import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FriendAvatar } from '../../friends/FriendAvatar';
import { v3Color, v3Font } from '../../../theme/throwLettersV3Tokens';
import type { V3ContactRow } from '../../../hooks/useLettersArrivalV3';

const s = (n: number, scale: number) => n * scale;

/** The horizontal contacts strip — each slot's own avatar/ring/badge/name/city, scaled and dimmed
 * when not the selected contact, per the handoff's own `p.sc`/`p.op`/`p.ring`. Tapping switches
 * contacts (no-op while an arrival/fold animation is already in flight — the caller's own `busy`
 * already gates `selectContact`, so this never needs to know about it itself). */
export function ContactsRowV3({ contacts, onSelect, scale }: { contacts: V3ContactRow[]; onSelect: (index: number) => void; scale: number }) {
  return (
    <View style={[styles.row, { gap: s(22, scale) }]}>
      {contacts.map((c, i) => (
        <Pressable key={c.id} onPress={() => onSelect(i)} style={[styles.slot, { width: s(78, scale), opacity: c.selected ? 1 : 0.6 }]} accessibilityRole="button" accessibilityLabel={c.name}>
          <View style={{ width: s(78, scale), height: s(78, scale), alignItems: 'center', justifyContent: 'center', transform: [{ scale: c.selected ? 1 : 0.86 }] }}>
            <View
              pointerEvents="none"
              style={[
                styles.ring,
                { borderRadius: s(39, scale), borderWidth: s(2.5, scale), borderColor: v3Color.accentBlue, opacity: c.selected ? 1 : 0 },
              ]}
            />
            {c.unreadCount > 0 && (
              <View style={[styles.badge, { minWidth: s(22, scale), height: s(22, scale), borderRadius: s(11, scale), paddingHorizontal: s(6, scale), borderWidth: s(2, scale) }]}>
                <Text style={[styles.badgeText, { fontSize: s(11, scale) }]}>{c.unreadCount}</Text>
              </View>
            )}
            <FriendAvatar userId={c.id} name={c.name} avatarUrl={c.avatarUrl} size={s(64, scale)} />
          </View>
          <Text style={[styles.name, { fontSize: s(13.5, scale), marginTop: s(4, scale) }]} numberOfLines={1}>
            {c.name}
          </Text>
          <Text style={[styles.city, { fontSize: s(11, scale) }]} numberOfLines={1}>
            {c.city}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center' },
  slot: { alignItems: 'center' },
  ring: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  badge: {
    position: 'absolute',
    right: -2,
    top: -2,
    zIndex: 2,
    backgroundColor: v3Color.accentBlue,
    borderColor: '#F4F4F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: v3Font.ui800, color: '#FFFFFF' },
  name: { fontFamily: v3Font.ui800, color: v3Color.ink, textAlign: 'center' },
  city: { fontFamily: v3Font.ui400, color: v3Color.mutedDark, textAlign: 'center' },
});
