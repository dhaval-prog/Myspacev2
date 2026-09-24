import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThrowMap } from '../../components/throw/ThrowMap';
import { RecipientCarousel } from '../../components/throw/RecipientCarousel';
import { FoldingLetter } from '../../components/throw/FoldingLetter';
import { throwColor, throwFont } from '../../theme/throwTokens';
import { useThrow } from '../../context/ThrowContext';
import type { StrokePath, ThrowLetter } from '../../types/throw';
import type { ThrowMapPin } from '../../components/throw/throwMapTypes';

interface ThrowHomeScreenProps {
  onHome: () => void;
  onOpenInbox: () => void;
  onThrown: (letter: ThrowLetter) => void;
  /** Set when arriving here via "Throw Back" — recipient is fixed, carousel is hidden. */
  lockedRecipient?: { friendUserId: string; repliedToThrowId: string } | null;
}

export function ThrowHomeScreen({ onHome, onOpenInbox, onThrown, lockedRecipient }: ThrowHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { myLocation, friends, unreadCount, sendThrow, uploadPhoto } = useThrow();
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const initializedRef = useRef(false);

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

  // Real "zoom to contact": the selected friend's own location, falling back to the user's own
  // pin — handed to ThrowMap's `focus` prop, which drives the actual map camera.
  const focusTarget = selectedFriend?.location ?? myLocation ?? null;

  const pins: ThrowMapPin[] = useMemo(() => {
    const list: ThrowMapPin[] = [];
    if (myLocation) list.push({ id: 'self', latitude: myLocation.latitude, longitude: myLocation.longitude, label: 'You', isSelf: true });
    for (const f of friendsWithLocation) {
      const selected = f.userId === selectedFriendId;
      list.push({
        id: f.userId,
        latitude: f.location!.latitude,
        longitude: f.location!.longitude,
        label: f.name.split(' ')[0],
        selected,
        dimmed: !selected && friendsWithLocation.length > 1,
        onPress: lockedRecipient ? undefined : () => setSelectedFriendId(f.userId),
      });
    }
    return list;
  }, [myLocation, friendsWithLocation, selectedFriendId, lockedRecipient]);

  const handleThrow = async (content: { messageText: string | null; strokes: StrokePath[] | null; penColor: string; photoUri: string | null }) => {
    if (!selectedFriend) return { error: 'Pick someone to throw to first.' };

    let photoUrl: string | null = null;
    if (content.photoUri) {
      const uploaded = await uploadPhoto(content.photoUri);
      if (uploaded.error) return { error: uploaded.error };
      photoUrl = uploaded.url;
    }

    const { error, letter } = await sendThrow({
      recipientId: selectedFriend.userId,
      messageText: content.messageText,
      strokes: content.strokes,
      penColor: content.penColor,
      photoUrl,
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
        {/* Balances the back button so the title stays centered — Inbox itself now lives in
            FoldingLetter's bottom-right control, alongside Photo and Voice. */}
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.mapArea}>
        <ThrowMap pins={pins} focus={focusTarget} />

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
              onOpenInbox={onOpenInbox}
              unreadCount={unreadCount}
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
  headerSpacer: { width: 48 },
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
