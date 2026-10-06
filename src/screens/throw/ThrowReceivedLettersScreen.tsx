import React, { useMemo, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThrowProvider, useThrow } from '../../context/ThrowContext';
import { LetterPlaneGlyph } from '../../components/throw/inbox/LetterPlaneGlyph';
import { ThrowMap } from '../../components/throw/ThrowMap';
import type { ThrowMapPin } from '../../components/throw/throwMapTypes';
import { ContactsRowV3 } from '../../components/throw/lettersV3/ContactsRowV3';
import { ToastV3 } from '../../components/throw/lettersV3/ToastV3';
import { LetterCardV3 } from '../../components/throw/lettersV3/LetterCardV3';
import { ActionRowV3 } from '../../components/throw/lettersV3/ActionRowV3';
import { ChipsRowV3 } from '../../components/throw/lettersV3/ChipsRowV3';
import { MediaViewerV3 } from '../../components/throw/lettersV3/MediaViewerV3';
import { useLettersArrivalV3, type V3Contact } from '../../hooks/useLettersArrivalV3';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { v3Color, v3Font, v3Layout } from '../../theme/throwLettersV3Tokens';
import { noSelect } from '../../theme/webStyles';

const s = (n: number, scale: number) => n * scale;
// Same commit-distance convention MediaViewerV3's own horizontal swipe uses.
const SWIPE_COMMIT_DISTANCE = 40;
// Matches FoldingLetter's own bottom anchor exactly (ThrowHomeScreen's `letterCard` style: `bottom:
// insets.bottom + 16 + BOTTOM_NAV_CLEARANCE` at rest) so the open letter here reads as the same
// height as Throw's own compose letter — raw device pixels in both, not run through `scale`.
const BOTTOM_NAV_CLEARANCE = 92;

interface ThrowReceivedLettersScreenProps {
  /** Reply, after its own fold-away + fly-to-corner exit — the caller lands on the existing Throw
   * compose flow for this contact (no separate "ThrowCompose" route exists in this app; Throw's
   * own screen already composes in place once a contact is focused). */
  onReply: (contactId: string, throwId: string) => void;
  /** Preselects this contact — set when reached from a specific chat thread's own Throw icon. */
  initialContactId?: string;
}

function ReceivedLettersInner({ onReply, initialContactId }: ThrowReceivedLettersScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { friends, inbox, deleteThrow, markRead, confirmThrowAlert } = useThrow();
  const [frameWidth, setFrameWidth] = useState(0);
  const [frameHeight, setFrameHeight] = useState(0);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [armed, setArmed] = useState(false);

  const contacts: V3Contact[] = useMemo(
    () =>
      friends
        .map((f) => ({
          id: f.userId,
          name: f.name,
          city: f.location?.city ?? '',
          avatarUrl: f.avatarUrl,
          letters: inbox.filter((l) => l.counterpartId === f.userId),
        }))
        .filter((c) => c.letters.length > 0),
    [friends, inbox],
  );

  const scale = frameWidth > 0 ? frameWidth / v3Layout.phone.width : 1;
  // The letter's own top (v3Layout.letter.y) stays exactly where it's always been — the envelope/
  // seal/plane-landing-point geometry is all tuned relative to it — only its bottom edge extends
  // further down to match FoldingLetter's own (see BOTTOM_NAV_CLEARANCE's comment). Falls back to
  // the original fixed token height until the frame's actually measured.
  const letterTopPx = insets.top + s(v3Layout.letter.y, scale);
  const letterHeightPx = frameHeight > 0 ? Math.max(s(200, scale), frameHeight - letterTopPx - (insets.bottom + 16 + BOTTOM_NAV_CLEARANCE)) : s(v3Layout.letter.h, scale);

  const arrival = useLettersArrivalV3({
    contacts,
    initialContactId,
    reduceMotion,
    scale,
    deleteThrow,
    markRead,
    confirmThrowAlert,
    onReply,
  });

  const topOffset = insets.top;
  const contactIdx = arrival.contactRows.findIndex((c) => c.selected);

  // The real, interactive world map behind Throw's own home screen, reused here as this screen's
  // background too — each contact with both a letter and a live location gets a pin (the active
  // one ringed/selected, the rest dimmed, same convention as ThrowHomeScreen's own pins), and the
  // map centers on whichever contact is currently open, by their *current* location (not the
  // letter's own send-time senderLatitude/senderLongitude).
  const mapPins: ThrowMapPin[] = useMemo(
    () =>
      friends.flatMap((f) => {
        if (!f.location || !contacts.some((c) => c.id === f.userId)) return [];
        const selected = f.userId === contacts[contactIdx]?.id;
        return [
          {
            id: f.userId,
            latitude: f.location.latitude,
            longitude: f.location.longitude,
            label: f.name,
            selected,
            dimmed: !selected,
            onPress: () => {
              const ci = contacts.findIndex((c) => c.id === f.userId);
              if (ci >= 0) arrival.selectContact(ci);
            },
          },
        ];
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [friends, contacts, contactIdx],
  );
  const activeLocation = contacts[contactIdx] ? (friends.find((f) => f.userId === contacts[contactIdx].id)?.location ?? null) : null;

  // Flicking the open letter itself steps to the adjacent contact — dragging right (positive dx)
  // reveals whatever is to the left (the previous contact), dragging left reveals the next one,
  // same left/right semantics (and commit distance) as MediaViewerV3's own horizontal swipe.
  // Clamped at the ends of the contact list rather than wrapping — `selectContact` doesn't itself
  // guard an out-of-range index, so this checks bounds before ever calling it.
  const letterSwipe = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderRelease: (_e, g) => {
          if (arrival.busy) return;
          if (g.dx >= SWIPE_COMMIT_DISTANCE) {
            if (contactIdx > 0) arrival.selectContact(contactIdx - 1);
          } else if (g.dx <= -SWIPE_COMMIT_DISTANCE) {
            if (contactIdx >= 0 && contactIdx < arrival.contactRows.length - 1) arrival.selectContact(contactIdx + 1);
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contactIdx, arrival.busy, arrival.contactRows.length],
  );

  if (contacts.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyTitle}>No letters yet</Text>
        <Text style={styles.emptySub}>Letters friends throw you will show up here.</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.screen}
      onLayout={(e) => {
        if (frameWidth === 0) setFrameWidth(e.nativeEvent.layout.width);
        if (frameHeight === 0) setFrameHeight(e.nativeEvent.layout.height);
      }}
    >
      <ThrowMap pins={mapPins} focus={activeLocation} />

      <View style={{ position: 'absolute', left: 0, right: 0, top: topOffset + s(v3Layout.contactsY, scale) }}>
        <ContactsRowV3 contacts={arrival.contactRows} onSelect={arrival.selectContact} scale={scale} />
      </View>

      <ToastV3 text={arrival.toast} scale={scale} top={topOffset + s(v3Layout.toastY, scale)} />

      {!!arrival.plane && (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: arrival.plane.shadowX - s(23, scale),
              top: topOffset + arrival.plane.shadowY - s(6, scale),
              width: s(46, scale),
              height: s(12, scale),
              borderRadius: s(6, scale),
              backgroundColor: 'rgba(0,0,0,.18)',
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: arrival.plane.x - s(32, scale),
              top: topOffset + arrival.plane.y - s(32, scale),
              transform: [{ rotate: `${arrival.plane.rot}deg` }, { scale: arrival.plane.scale }],
            }}
          >
            <LetterPlaneGlyph size={s(64, scale)} variant="default" />
          </View>
        </>
      )}

      <View style={[{ position: 'absolute', left: s(v3Layout.letter.x, scale), top: topOffset + s(v3Layout.letter.y, scale) }, noSelect]} {...letterSwipe.panHandlers}>
        <LetterCardV3 stage={arrival.stage} letter={arrival.cardData} isEmpty={arrival.isEmpty} emptyName={arrival.curContactName} scale={scale} heightPx={letterHeightPx} />
      </View>

      <View style={{ position: 'absolute', left: s(v3Layout.actionRow.x, scale), right: s(v3Layout.actionRow.x, scale), top: topOffset + s(v3Layout.actionRow.y, scale) }}>
        <ActionRowV3
          visible={arrival.stage === 'open' && !armed && !mediaOpen}
          letter={arrival.cardData}
          onReply={arrival.reply}
          onConfirm={arrival.confirmAlert}
          onOpenMedia={() => setMediaOpen(true)}
          scale={scale}
        />
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: s(v3Layout.chipRow.bottom, scale) + insets.bottom }}>
        <ChipsRowV3
          rowTitle={arrival.rowTitle}
          chips={arrival.chips}
          activeIndex={arrival.activeLetterIdx}
          busy={arrival.busy}
          onSelectChip={arrival.selectChip}
          onDeleteCommit={arrival.deleteActive}
          onArmedChange={setArmed}
          scale={scale}
        />
      </View>

      <MediaViewerV3
        visible={mediaOpen}
        contactName={arrival.curContactName}
        dateShort={arrival.cardData?.date.split(' · ')[0] ?? ''}
        place={arrival.cardData?.place ?? ''}
        photoUrls={arrival.cardData?.photoUrls ?? []}
        photoTrims={arrival.cardData?.photoTrims ?? []}
        onClose={() => setMediaOpen(false)}
        scale={scale}
      />
    </View>
  );
}

/** The Received Letters v3 screen — reached from the Chats list's own "Received Letters" icon
 * (and, when `initialContactId` is set, from a specific chat thread's own Throw icon), independent
 * of ThrowHomeScreen's own in-place received-letters panel, which stays exactly as it already is.
 * Mounts its own `ThrowProvider` (same "each screen that needs Throw data wraps its own" pattern
 * `ThrowScreen` already uses) since this is reached from outside Throw's own navigator. */
export function ThrowReceivedLettersScreen(props: ThrowReceivedLettersScreenProps) {
  return (
    <ThrowProvider>
      <ReceivedLettersInner {...props} />
    </ThrowProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: v3Color.mapBg, overflow: 'hidden' },
  emptyScreen: { flex: 1, backgroundColor: v3Color.mapBg, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: v3Font.ui800, fontSize: 18, color: v3Color.ink },
  emptySub: { fontFamily: v3Font.ui400, fontSize: 13.5, color: v3Color.mutedDark, textAlign: 'center' },
});
