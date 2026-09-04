import React, { useEffect, useRef } from 'react';
import { Animated, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { FriendAvatar } from '../friends/FriendAvatar';
import { useFriends } from '../../context/FriendsContext';
import { npColor, npFont, LETTER_TILES } from '../../theme/npatTokens';

const INVITE_MESSAGE = 'Come play Name, Place, Animal, Thing with me on MySpace!';

function Tile({ index, reduceMotion }: { index: number; reduceMotion?: boolean }) {
  const tile = LETTER_TILES[index];
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(progress, { toValue: 1, duration: 550, delay: index * 90, useNativeDriver: true }).start();
  }, [reduceMotion, progress, index]);

  const opacity = progress;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <Animated.View
      style={[
        styles.tile,
        { backgroundColor: tile.bg, opacity, transform: [{ translateY }, { scale }, { rotate: `${tile.rotateDeg}deg` }, { translateY: tile.translateY }] },
      ]}
    >
      <Text style={styles.tileLabel}>{tile.letter}</Text>
    </Animated.View>
  );
}

function OnlineNowRow({ reduceMotion }: { reduceMotion?: boolean }) {
  const { friends, isOnline } = useFriends();
  const online = friends.filter((f) => isOnline(f.userId));
  const shown = online.slice(0, 3);
  const overflow = online.length - shown.length;
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(progress, { toValue: 1, duration: 500, delay: 300, useNativeDriver: true }).start();
  }, [reduceMotion, progress]);

  const inviteAll = () => {
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(INVITE_MESSAGE)}`);
  };

  const opacity = progress;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  return (
    <Animated.View style={[styles.onlineWrap, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.onlineHeaderRow}>
        <Text style={styles.onlineEyebrow}>ONLINE NOW</Text>
        <Pressable onPress={inviteAll} accessibilityRole="button" accessibilityLabel="Invite all online friends">
          <Text style={styles.inviteAll}>Invite all</Text>
        </Pressable>
      </View>
      {online.length === 0 ? (
        <Text style={styles.emptyOnline}>No friends online right now</Text>
      ) : (
        <View style={styles.chipsRow}>
          {shown.map((f) => (
            <View key={f.connectionId} style={styles.chip}>
              <FriendAvatar userId={f.userId} name={f.name} avatarUrl={f.avatarUrl} size={34} initialsFontFamily={npFont.sans700} initialsFontSize={12.5} />
              <Text style={styles.chipName} numberOfLines={1}>
                {f.name.split(' ')[0]}
              </Text>
            </View>
          ))}
          {overflow > 0 && (
            <View style={[styles.chip, styles.chipMuted]}>
              <View style={styles.overflowCircle}>
                <Text style={styles.overflowLabel}>+{overflow}</Text>
              </View>
              <Text style={styles.chipNameMuted}>more</Text>
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
}

interface NpatHeaderProps {
  showOnlineRow: boolean;
  reduceMotion?: boolean;
}

/** Dark header shared by every NPAT lobby state (1A/1B/waiting room): title, subtitle, the four dealt letter tiles, and — only pre-create — a real online-friends row with a working WhatsApp "Invite all". */
export function NpatHeader({ showOnlineRow, reduceMotion }: NpatHeaderProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Games</Text>
      <Text style={styles.subtitle}>Name, Place, Animal, Thing — live with friends.</Text>
      <View style={[styles.tilesRow, showOnlineRow ? styles.tilesRowTall : styles.tilesRowShort]}>
        {LETTER_TILES.map((t, i) => (
          <Tile key={t.letter} index={i} reduceMotion={reduceMotion} />
        ))}
      </View>
      {showOnlineRow && <OnlineNowRow reduceMotion={reduceMotion} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 22, paddingTop: 30 },
  title: { fontFamily: npFont.sans800, fontSize: 30, lineHeight: 33, letterSpacing: -1.1, color: '#FFFFFF' },
  subtitle: { fontFamily: npFont.sans400, fontSize: 12.5, lineHeight: 18.1, color: npColor.onDark60, marginTop: 5 },
  tilesRow: { flexDirection: 'row', gap: 8 },
  tilesRowTall: { marginTop: 22 },
  tilesRowShort: { marginTop: 14 },
  tile: { flex: 1, aspectRatio: 1 / 0.8, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontFamily: npFont.sans800, fontSize: 28, lineHeight: 28, color: npColor.ink },
  onlineWrap: { marginTop: 12 },
  onlineHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
  onlineEyebrow: { fontFamily: npFont.mono500, fontSize: 9.5, letterSpacing: 9.5 * 0.14, color: npColor.onDark52 },
  inviteAll: { fontFamily: npFont.sans600, fontSize: 11.5, color: npColor.lime },
  emptyOnline: { fontFamily: npFont.sans400, fontSize: 11.5, color: npColor.onDark42 },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, backgroundColor: 'rgba(255,255,255,.08)', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', gap: 5 },
  chipMuted: { backgroundColor: 'rgba(255,255,255,.05)' },
  chipName: { fontFamily: npFont.sans600, fontSize: 10.5, color: '#FFFFFF' },
  chipNameMuted: { fontFamily: npFont.sans500, fontSize: 10.5, color: npColor.onDark50 },
  overflowCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' },
  overflowLabel: { fontFamily: npFont.sans700, fontSize: 12, color: 'rgba(255,255,255,.75)' },
});
