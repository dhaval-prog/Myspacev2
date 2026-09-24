import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorldMapBackdrop } from '../../components/throw/WorldMapBackdrop';
import { LocationPin } from '../../components/throw/LocationPin';
import { RecipientCarousel } from '../../components/throw/RecipientCarousel';
import { FoldingLetter } from '../../components/throw/FoldingLetter';
import { project } from '../../utils/mapProjection';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
import { useThrow } from '../../context/ThrowContext';
import type { StrokePath, ThrowLetter } from '../../types/throw';

interface ThrowHomeScreenProps {
  onHome: () => void;
  onOpenInbox: () => void;
  onThrown: (letter: ThrowLetter) => void;
  /** Set when arriving here via "Throw Back" — recipient is fixed, carousel is hidden. */
  lockedRecipient?: { friendUserId: string; repliedToThrowId: string } | null;
}

export function ThrowHomeScreen({ onHome, onOpenInbox, onThrown, lockedRecipient }: ThrowHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { myLocation, friends, unreadCount, sendThrow } = useThrow();
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const friendsWithLocation = useMemo(() => friends.filter((f) => f.location), [friends]);
  const hasFriendsAtAll = friends.length > 0;

  useEffect(() => {
    if (initializedRef.current || friendsWithLocation.length === 0) return;
    initializedRef.current = true;
    const wanted = lockedRecipient?.friendUserId;
    const found = wanted ? friendsWithLocation.find((f) => f.userId === wanted) : null;
    setSelectedFriendId((found ?? friendsWithLocation[0]).userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendsWithLocation]);

  useEffect(() => {
    focusAnim.setValue(0);
    Animated.timing(focusAnim, { toValue: 1, duration: 450, useNativeDriver: false }).start();
  }, [selectedFriendId, focusAnim]);

  const selectedIndex = Math.max(0, friendsWithLocation.findIndex((f) => f.userId === selectedFriendId));
  const selectedFriend = friendsWithLocation.find((f) => f.userId === selectedFriendId) ?? null;

  const onMapLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setMapSize({ width, height });
  };

  const mapScale = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });

  const handleThrow = async (content: { messageText: string | null; strokes: StrokePath[] | null; penColor: string }) => {
    if (!selectedFriend) return { error: 'Pick someone to throw to first.' };
    const { error, letter } = await sendThrow({
      recipientId: selectedFriend.userId,
      messageText: content.messageText,
      strokes: content.strokes,
      penColor: content.penColor,
      repliedToThrowId: lockedRecipient?.repliedToThrowId,
    });
    if (error || !letter) return { error: error ?? 'Could not send — try again.' };
    onThrown(letter);
    return { error: null };
  };

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

      {lockedRecipient ? (
        selectedFriend && (
          <Text style={styles.replyLine} numberOfLines={1}>
            Throwing back to {selectedFriend.name}
          </Text>
        )
      ) : (
        <RecipientCarousel friends={friendsWithLocation} selectedIndex={selectedIndex} onChangeIndex={(i) => setSelectedFriendId(friendsWithLocation[i]?.userId ?? null)} />
      )}

      <View style={styles.mapArea} onLayout={onMapLayout}>
        {mapSize.width > 0 && (
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: mapScale }] }]}>
            <WorldMapBackdrop width={mapSize.width} height={mapSize.height} />
            {myLocation &&
              (() => {
                const { x, y } = project(myLocation, mapSize.width, mapSize.height);
                return <LocationPin x={x} y={y} label="You" isSelf />;
              })()}
            {friendsWithLocation.map((f) => {
              const { x, y } = project(f.location!, mapSize.width, mapSize.height);
              const selected = f.userId === selectedFriendId;
              return (
                <LocationPin
                  key={f.userId}
                  x={x}
                  y={y}
                  label={f.name.split(' ')[0]}
                  selected={selected}
                  dimmed={!selected && friendsWithLocation.length > 1}
                  onPress={lockedRecipient ? undefined : () => setSelectedFriendId(f.userId)}
                />
              );
            })}
          </Animated.View>
        )}

        {!hasFriendsAtAll && (
          <View style={styles.emptyOverlay}>
            <Text style={styles.emptyTitle}>Nothing to throw yet.</Text>
            <Text style={styles.emptyBody}>Add people to your circle to start sending letters across the world.</Text>
          </View>
        )}

        {hasFriendsAtAll && selectedFriend && (
          <View style={[styles.letterCard, { bottom: insets.bottom + 16 }]}>
            <FoldingLetter
              recipientName={selectedFriend.name}
              recipientCity={selectedFriend.location!.city}
              onThrow={handleThrow}
              throwLabel={lockedRecipient ? 'Swipe up to throw back' : 'Swipe up to throw'}
            />
          </View>
        )}
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
    paddingBottom: 8,
  },
  headerBack: { fontFamily: throwFont.ui600, fontSize: 13.5, color: throwColor.inkSoft },
  headerTitle: { fontFamily: throwFont.hand700, fontSize: 26, color: throwColor.ink },
  inboxBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inboxLabel: { fontFamily: throwFont.ui600, fontSize: 13.5, color: throwColor.clayDeep },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: throwColor.unread, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeLabel: { fontFamily: throwFont.ui700, fontSize: 10.5, color: '#fff' },
  replyLine: { textAlign: 'center', fontFamily: throwFont.ui700, fontSize: 15, color: throwColor.ink, paddingVertical: 12 },
  mapArea: { flex: 1, marginHorizontal: 12, marginBottom: 12, borderRadius: 20, overflow: 'hidden' },
  emptyOverlay: {
    position: 'absolute',
    top: '38%',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  emptyTitle: { fontFamily: throwFont.ui700, fontSize: 16, color: throwColor.ink, marginBottom: 6, textAlign: 'center' },
  emptyBody: { fontFamily: throwFont.ui400, fontSize: 13, color: throwColor.inkSoft, textAlign: 'center', lineHeight: 19 },
  letterCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '32%',
    backgroundColor: throwColor.screenBg,
    borderRadius: throwRadius.card,
    padding: 14,
    ...throwColor.shadowSoft,
  },
});
