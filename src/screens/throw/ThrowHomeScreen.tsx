import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorldMapBackdrop } from '../../components/throw/WorldMapBackdrop';
import { LocationPin } from '../../components/throw/LocationPin';
import { RecipientCarousel } from '../../components/throw/RecipientCarousel';
import { FoldingLetter } from '../../components/throw/FoldingLetter';
import { project } from '../../utils/mapProjection';
import { throwColor, throwFont } from '../../theme/throwTokens';
import { useThrow } from '../../context/ThrowContext';
import type { StrokePath, ThrowLetter } from '../../types/throw';

interface ThrowHomeScreenProps {
  onHome: () => void;
  onOpenInbox: () => void;
  onThrown: (letter: ThrowLetter) => void;
  /** Set when arriving here via "Throw Back" — recipient is fixed, carousel is hidden. */
  lockedRecipient?: { friendUserId: string; repliedToThrowId: string } | null;
}

/** How far in the map zooms once it has a location to center on — the world map is ~2:1, so this
 * is roughly "city block" scale rather than "country" scale. */
const FOCUS_ZOOM = 4.5;

export function ThrowHomeScreen({ onHome, onOpenInbox, onThrown, lockedRecipient }: ThrowHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { myLocation, friends, unreadCount, sendThrow } = useThrow();
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const mapTranslateX = useRef(new Animated.Value(0)).current;
  const mapTranslateY = useRef(new Animated.Value(0)).current;

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

  const selectedIndex = Math.max(0, friendsWithLocation.findIndex((f) => f.userId === selectedFriendId));
  const selectedFriend = friendsWithLocation.find((f) => f.userId === selectedFriendId) ?? null;

  const onMapLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setMapSize({ width, height });
  };

  // The map is rendered at `zoomFactor`x its natural size, then translated so the focused point
  // (the selected contact, falling back to the user's own pin) sits centered in the viewport —
  // real zoom rather than a cosmetic scale pulse, since a flat `scale` transform only magnifies
  // around the view's own center, not around any particular contact's location.
  const focusTarget = selectedFriend?.location ?? myLocation ?? null;
  const zoomFactor = focusTarget && mapSize.width > 0 ? FOCUS_ZOOM : 1;
  const bigMapWidth = mapSize.width * zoomFactor;
  const bigMapHeight = mapSize.height * zoomFactor;

  useEffect(() => {
    if (mapSize.width <= 0 || mapSize.height <= 0) return;
    const focal = focusTarget ? project(focusTarget, bigMapWidth, bigMapHeight) : { x: bigMapWidth / 2, y: bigMapHeight / 2 };
    Animated.parallel([
      Animated.timing(mapTranslateX, { toValue: mapSize.width / 2 - focal.x, duration: 500, useNativeDriver: false }),
      Animated.timing(mapTranslateY, { toValue: mapSize.height / 2 - focal.y, duration: 500, useNativeDriver: false }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFriendId, mapSize.width, mapSize.height, myLocation?.latitude, myLocation?.longitude]);

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

      <View style={styles.mapArea} onLayout={onMapLayout}>
        {mapSize.width > 0 && (
          <Animated.View style={{ position: 'absolute', width: bigMapWidth, height: bigMapHeight, transform: [{ translateX: mapTranslateX }, { translateY: mapTranslateY }] }}>
            <WorldMapBackdrop width={bigMapWidth} height={bigMapHeight} />
            {myLocation &&
              (() => {
                const { x, y } = project(myLocation, bigMapWidth, bigMapHeight);
                return <LocationPin x={x} y={y} label="You" isSelf />;
              })()}
            {friendsWithLocation.map((f) => {
              const { x, y } = project(f.location!, bigMapWidth, bigMapHeight);
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

        {lockedRecipient ? (
          selectedFriend && (
            <View style={styles.recipientOverlay}>
              <Text style={styles.replyLine} numberOfLines={1}>
                Throwing back to {selectedFriend.name}
              </Text>
            </View>
          )
        ) : (
          <View style={styles.recipientOverlay}>
            <RecipientCarousel friends={friendsWithLocation} selectedIndex={selectedIndex} onChangeIndex={(i) => setSelectedFriendId(friendsWithLocation[i]?.userId ?? null)} />
          </View>
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
  mapArea: { flex: 1, marginHorizontal: 12, marginTop: 4, marginBottom: 12, borderRadius: 20, overflow: 'hidden' },
  recipientOverlay: { position: 'absolute', top: 8, left: 0, right: 0 },
  replyLine: {
    textAlign: 'center',
    fontFamily: throwFont.ui700,
    fontSize: 15,
    color: throwColor.ink,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 40,
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(251,246,236,.88)',
    overflow: 'hidden',
  },
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
  },
});
