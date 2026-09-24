import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatMiles, haversineMiles } from '../../utils/geo';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
import type { ThrowFriend, ThrowLocation } from '../../types/throw';

interface ContactLocationCardProps {
  friend: ThrowFriend;
  myLocation: ThrowLocation | null;
  onPress: () => void;
}

export function ContactLocationCard({ friend, myLocation, onPress }: ContactLocationCardProps) {
  const distance =
    myLocation && friend.location ? formatMiles(haversineMiles(myLocation, friend.location)) : null;
  const initial = (friend.name.trim()[0] ?? '?').toUpperCase();

  return (
    <Pressable onPress={onPress} disabled={!friend.location}>
      <View style={[styles.row, !friend.location && styles.rowDisabled]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{friend.name}</Text>
          <Text style={styles.city} numberOfLines={1}>
            {friend.location ? `${friend.location.city}, ${friend.location.country}` : "Hasn't set a Throw location yet"}
          </Text>
        </View>
        {distance && <Text style={styles.distance}>{distance}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 10,
    backgroundColor: throwColor.cardBg,
    borderRadius: throwRadius.card,
    borderWidth: 1,
    borderColor: throwColor.cardBorder,
  },
  rowDisabled: { opacity: 0.5 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: throwColor.claySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: throwFont.ui700, fontSize: 15, color: throwColor.clayDeep },
  name: { fontFamily: throwFont.ui700, fontSize: 15, color: throwColor.ink },
  city: { fontFamily: throwFont.ui400, fontSize: 12.5, color: throwColor.inkSoft, marginTop: 2 },
  distance: { fontFamily: throwFont.mono500, fontSize: 11.5, color: throwColor.clayDeep },
});
