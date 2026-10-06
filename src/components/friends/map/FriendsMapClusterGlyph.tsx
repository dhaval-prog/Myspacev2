import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fmColor, fmFont } from '../../../theme/friendsMapTokens';
import { avatarSkinFor, initialsOf } from '../../../utils/friendAvatar';

interface FriendsMapClusterGlyphProps {
  count: number;
  members: { userId: string; name: string }[];
  scale: number;
}

/** A merged group of nearby pins — an ink pill with the first two members' initials circles
 * overlapping, plus the total count in lime. No positioning of its own, same split as
 * `FriendsMapPinGlyph`. */
export function FriendsMapClusterGlyph({ count, members, scale }: FriendsMapClusterGlyphProps) {
  const circleSize = Math.round(30 * scale);
  return (
    <View style={[styles.pill, { height: 48 * scale, borderRadius: 24 * scale, paddingLeft: 5 * scale, paddingRight: 12 * scale, gap: 8 * scale, borderWidth: 3 * scale }]}>
      <View style={{ flexDirection: 'row' }}>
        {members.slice(0, 2).map((m, i) => {
          const skin = avatarSkinFor(m.userId);
          return (
            <View
              key={m.userId}
              style={[
                styles.circle,
                { width: circleSize, height: circleSize, borderRadius: circleSize / 2, backgroundColor: skin.bg, marginLeft: i === 0 ? 0 : -12 * scale, borderWidth: i === 0 ? 0 : 2 * scale },
              ]}
            >
              <Text style={[styles.circleText, { color: skin.fg, fontSize: 10 * scale }]}>{initialsOf(m.name)}</Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.count, { fontSize: 14 * scale }]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: fmColor.ink,
    alignItems: 'center',
    flexDirection: 'row',
    borderColor: fmColor.white,
    shadowColor: fmColor.ink,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
  },
  circle: { alignItems: 'center', justifyContent: 'center', borderColor: fmColor.ink },
  circleText: { fontFamily: fmFont.ui700 },
  count: { fontFamily: fmFont.ui700, color: fmColor.lime },
});
