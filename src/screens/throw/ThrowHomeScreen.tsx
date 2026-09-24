import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorldMapBackdrop } from '../../components/throw/WorldMapBackdrop';
import { LocationPin } from '../../components/throw/LocationPin';
import { ThrowButton } from '../../components/throw/ThrowButton';
import { project } from '../../utils/mapProjection';
import { throwColor, throwFont } from '../../theme/throwTokens';
import { useThrow } from '../../context/ThrowContext';

interface ThrowHomeScreenProps {
  onHome: () => void;
  onOpenPicker: () => void;
  onOpenComposeWith: (friendUserId: string) => void;
  onOpenInbox: () => void;
}

export function ThrowHomeScreen({ onHome, onOpenPicker, onOpenComposeWith, onOpenInbox }: ThrowHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { myLocation, friends, unreadCount } = useThrow();
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

  const onMapLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setMapSize({ width, height });
  };

  const friendsWithLocation = friends.filter((f) => f.location);
  const hasFriendsAtAll = friends.length > 0;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onHome} hitSlop={10}>
          <Text style={styles.headerBack}>‹ Home</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Throw</Text>
        <Pressable onPress={onOpenInbox} hitSlop={10} style={styles.inboxBtn}>
          <Text style={styles.inboxLabel}>Inbox</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>{unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.mapArea} onLayout={onMapLayout}>
        {mapSize.width > 0 && (
          <>
            <WorldMapBackdrop width={mapSize.width} height={mapSize.height} />
            {myLocation &&
              (() => {
                const { x, y } = project(myLocation, mapSize.width, mapSize.height);
                return <LocationPin x={x} y={y} label="You" isSelf />;
              })()}
            {friendsWithLocation.map((f) => {
              const { x, y } = project(f.location!, mapSize.width, mapSize.height);
              return <LocationPin key={f.userId} x={x} y={y} label={f.name.split(' ')[0]} onPress={() => onOpenComposeWith(f.userId)} />;
            })}
          </>
        )}

        {!hasFriendsAtAll && (
          <View style={styles.emptyOverlay}>
            <Text style={styles.emptyTitle}>Nothing to throw yet.</Text>
            <Text style={styles.emptyBody}>Add people to your circle to start sending letters across the world.</Text>
          </View>
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <ThrowButton onPress={onOpenPicker} disabled={!hasFriendsAtAll}>
          Throw
        </ThrowButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: throwColor.screenBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerBack: { fontFamily: throwFont.ui600, fontSize: 13.5, color: throwColor.inkSoft },
  headerTitle: { fontFamily: throwFont.hand700, fontSize: 26, color: throwColor.ink },
  inboxBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inboxLabel: { fontFamily: throwFont.ui600, fontSize: 13.5, color: throwColor.clayDeep },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: throwColor.unread, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeLabel: { fontFamily: throwFont.ui700, fontSize: 10.5, color: '#fff' },
  mapArea: { flex: 1, marginHorizontal: 12, borderRadius: 20, overflow: 'hidden' },
  emptyOverlay: {
    position: 'absolute',
    top: '38%',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  emptyTitle: { fontFamily: throwFont.ui700, fontSize: 16, color: throwColor.ink, marginBottom: 6, textAlign: 'center' },
  emptyBody: { fontFamily: throwFont.ui400, fontSize: 13, color: throwColor.inkSoft, textAlign: 'center', lineHeight: 19 },
  footer: { paddingHorizontal: 20, paddingTop: 14 },
});
