import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { FriendAvatar } from '../../friends/FriendAvatar';
import { inboxColor } from '../../../theme/throwInboxTokens';

export interface ContactRailItem {
  id: string;
  name: string;
  sub: string;
  avatarUrl: string | null;
  count: number;
}

interface ContactsRailProps {
  contacts: ContactRailItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  scale: number;
  disabled?: boolean;
}

const s = (n: number, scale: number) => n * scale;
const SCALE_EASING = Easing.bezier(0.3, 1.4, 0.5, 1);

function ContactItem({ item, selected, onSelect, scale, disabled }: { item: ContactRailItem; selected: boolean; onSelect: () => void; scale: number; disabled?: boolean }) {
  const itemScale = useRef(new Animated.Value(selected ? 1 : 0.86)).current;
  const opacity = useRef(new Animated.Value(selected ? 1 : 0.6)).current;
  const ringOpacity = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(itemScale, { toValue: selected ? 1 : 0.86, duration: 400, easing: SCALE_EASING, useNativeDriver: true }).start();
    Animated.timing(opacity, { toValue: selected ? 1 : 0.6, duration: 300, useNativeDriver: true }).start();
    Animated.timing(ringOpacity, { toValue: selected ? 1 : 0, duration: 300, useNativeDriver: true }).start();
  }, [selected, itemScale, opacity, ringOpacity]);

  return (
    <Animated.View style={{ opacity, width: s(78, scale), alignItems: 'center' }}>
      <Pressable onPress={onSelect} disabled={disabled} accessibilityRole="button" accessibilityLabel={item.name}>
        <Animated.View style={{ width: s(78, scale), height: s(78, scale), alignItems: 'center', justifyContent: 'center', transform: [{ scale: itemScale }] }}>
          <Animated.View pointerEvents="none" style={[styles.ring, { width: s(78, scale), height: s(78, scale), borderRadius: s(39, scale), opacity: ringOpacity }]} />
          <FriendAvatar userId={item.id} name={item.name} avatarUrl={item.avatarUrl} size={s(64, scale)} initialsFontSize={s(20, scale)} />
          {/* Rendered last (after both the ring and the avatar itself) so it always paints on
              top of them — a badge tucked behind the avatar's own circle would get clipped right
              where it overlaps, instead of sitting above the border the way it should. */}
          {item.count > 0 && (
            <View style={[styles.badge, { minWidth: s(22, scale), height: s(22, scale), borderRadius: s(11, scale), paddingHorizontal: s(6, scale), borderWidth: s(2, scale) }]}>
              <Text style={[styles.badgeText, { fontSize: s(11, scale) }]}>{item.count}</Text>
            </View>
          )}
        </Animated.View>
      </Pressable>
      <Text style={[styles.name, { fontSize: s(13.5, scale), marginTop: s(4, scale) }]} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={[styles.sub, { fontSize: s(11, scale) }]} numberOfLines={1}>
        {item.sub}
      </Text>
    </Animated.View>
  );
}

/**
 * The top contact row — the selected contact gets a blue ring + full opacity, others scale down
 * to 0.86 at 60% opacity, per the design handoff. Real `FriendAvatar` photos/initials stand in
 * for the handoff's own flat colored-circle mock avatars (no per-contact "bg color" exists on
 * real friend data).
 */
export function ContactsRail({ contacts, selectedId, onSelect, scale, disabled }: ContactsRailProps) {
  return (
    <View style={[styles.row, { gap: s(22, scale) }]}>
      {contacts.map((c) => (
        <ContactItem key={c.id} item={c} selected={c.id === selectedId} onSelect={() => onSelect(c.id)} scale={scale} disabled={disabled} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2.5, borderColor: inboxColor.accentBlue },
  badge: {
    position: 'absolute',
    right: -2,
    top: -2,
    backgroundColor: inboxColor.accentBlue,
    // Plain white, not the rail's own near-white background tone — so it reads clearly as a
    // border sitting on top of (and overlapping) the ring/avatar underneath, per explicit request.
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  badgeText: { color: '#FFFFFF', fontFamily: 'Figtree_800ExtraBold' },
  name: { fontFamily: 'Figtree_800ExtraBold', color: inboxColor.ink, textAlign: 'center' },
  sub: { fontFamily: 'Figtree_400Regular', color: '#6F6F6B', textAlign: 'center' },
});
