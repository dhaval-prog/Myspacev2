import React, { useMemo, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThrowProvider, useThrow } from '../../context/ThrowContext';
import { LetterPlaneGlyph } from '../../components/throw/inbox/LetterPlaneGlyph';
import { BottomNav } from '../../components/BottomNav';
import { ThrowMap } from '../../components/throw/ThrowMap';
import type { ThrowMapPin } from '../../components/throw/throwMapTypes';
import { ContactsRowV3 } from '../../components/throw/lettersV3/ContactsRowV3';
import { ToastV3 } from '../../components/throw/lettersV3/ToastV3';
import { LetterCardV3 } from '../../components/throw/lettersV3/LetterCardV3';
import { ActionRowV3 } from '../../components/throw/lettersV3/ActionRowV3';
import { ChipsRowV3 } from '../../components/throw/lettersV3/ChipsRowV3';
import { MediaViewerV3 } from '../../components/throw/lettersV3/MediaViewerV3';
import { FoldingLetter } from '../../components/throw/FoldingLetter';
import { useLettersArrivalV3, type V3Contact } from '../../hooks/useLettersArrivalV3';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { v3Color, v3Font, v3Layout } from '../../theme/throwLettersV3Tokens';
import { noSelect } from '../../theme/webStyles';
import type { AlertSchedule, MediaTrim, StrokePath } from '../../types/throw';

const s = (n: number, scale: number) => n * scale;
// Same commit-distance convention MediaViewerV3's own horizontal swipe uses.
const SWIPE_COMMIT_DISTANCE = 40;
// Matches FoldingLetter's own bottom anchor exactly (ThrowHomeScreen's `letterCard` style: `bottom:
// insets.bottom + 16 + BOTTOM_NAV_CLEARANCE` at rest) so the open letter here reads as the same
// height as Throw's own compose letter — raw device pixels in both, not run through `scale`.
const BOTTOM_NAV_CLEARANCE = 92;
const BACK_ICON = 'M15 18l-6-6 6-6';

interface ThrowReceivedLettersScreenProps {
  /** Preselects this contact — set when reached from a specific chat thread's own Throw icon. */
  initialContactId?: string;
  /** Set when reached by tapping ThrowHomeScreen's own "X sent you a letter" toast (see its
   * liftoff animation) — skips the arrival screen's usual 600ms lead-in beat before the plane
   * starts flying in, so it reads as a continuation of the toast's own launch rather than a
   * second, independent pause. */
  viaToast?: boolean;
  /** The shared bottom nav dock's own destinations — this screen had no way back out besides
   * Reply before, so the dock doubles as its exit (its "+" slot is repurposed as Back, landing on
   * Throw's own home screen, same destination its own Throw tab already goes to). */
  onOpenThrow: () => void;
  onOpenChats: () => void;
  onOpenMap: () => void;
  onOpenGames: () => void;
  onOpenExpenses: () => void;
}

function ReceivedLettersInner({ initialContactId, viaToast, onOpenThrow, onOpenChats, onOpenMap, onOpenGames, onOpenExpenses }: ThrowReceivedLettersScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { friends, inbox, deleteThrow, markRead, confirmThrowAlert, sendThrow, uploadPhoto } = useThrow();
  const [frameWidth, setFrameWidth] = useState(0);
  const [frameHeight, setFrameHeight] = useState(0);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  // Set once Reply's own fold-away exit finishes (see useLettersArrivalV3's onReply) — swaps the
  // read-only LetterCardV3 for a real FoldingLetter compose surface addressed to this same
  // contact, reusing Throw's own write/fold/throw gesture wholesale rather than a separate
  // "ThrowCompose" route (there isn't one — see FoldingLetter's own doc comment).
  const [replyTarget, setReplyTarget] = useState<{ contactId: string; letterId: string; recipientName: string } | null>(null);

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
    onReply: (contactId, letterId) => {
      const contact = contacts.find((c) => c.id === contactId);
      if (contact) setReplyTarget({ contactId, letterId, recipientName: contact.name });
    },
    skipLeadIn: viaToast,
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

  // The actual send, once the user flicks the folded reply plane up — same upload-then-submit
  // sequence as ThrowHomeScreen's own handleThrow (non-self branch), just always addressed to
  // this contact and always carrying repliedToThrowId, matching "Throw Back"'s existing
  // server-side linkage instead of a plain unlinked letter.
  const handleReplyThrow = async (content: {
    messageText: string | null;
    strokes: StrokePath[] | null;
    penColor: string;
    photoUris: string[];
    photoTrims: (MediaTrim | null)[];
    alertSchedule: AlertSchedule | null;
  }) => {
    if (!replyTarget) return { error: 'Something went wrong.' };
    const photoUrls: string[] = [];
    const photoTrims: (MediaTrim | null)[] = [];
    for (let i = 0; i < content.photoUris.length; i++) {
      const uploaded = await uploadPhoto(content.photoUris[i]);
      if (uploaded.error) return { error: uploaded.error };
      if (uploaded.url) {
        photoUrls.push(uploaded.url);
        photoTrims.push(content.photoTrims[i] ?? null);
      }
    }
    const { error } = await sendThrow({
      recipientId: replyTarget.contactId,
      messageText: content.messageText,
      strokes: content.strokes,
      penColor: content.penColor,
      photoUrls,
      photoTrims,
      repliedToThrowId: replyTarget.letterId,
      alertSchedule: content.alertSchedule,
    });
    if (error) return { error };
    return { error: null };
  };

  // Once the liftoff flourish finishes, the reply's done — back to the letter's ordinary read
  // view (closeReply resets the stage 'reply()' left it on) rather than leaving the compose
  // surface up or navigating anywhere else.
  const closeReplyCompose = () => {
    setReplyTarget(null);
    arrival.closeReply();
  };

  if (contacts.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyTitle}>No letters yet</Text>
        <Text style={styles.emptySub}>Letters friends throw you will show up here.</Text>
        <View style={styles.bottomNavWrap}>
          <BottomNav
            activeId="throw"
            onSelect={(id) => {
              if (id === 'chat') onOpenChats();
              if (id === 'map') onOpenMap();
              if (id === 'games') onOpenGames();
              if (id === 'expenses') onOpenExpenses();
            }}
            onAdd={onOpenThrow}
            fabIconPath={BACK_ICON}
            fabAccessibilityLabel="Back"
            bottomInset={insets.bottom}
            reduceMotion={reduceMotion}
          />
        </View>
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
        <ContactsRowV3 contacts={arrival.contactRows} onSelect={replyTarget ? () => {} : arrival.selectContact} scale={scale} />
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

      {replyTarget ? (
        <View style={{ position: 'absolute', left: 18, right: 18, top: topOffset + s(v3Layout.letter.y, scale), height: letterHeightPx }}>
          <View style={styles.replyCardContent}>
            <FoldingLetter
              recipientName={replyTarget.recipientName}
              streak={0}
              points={0}
              hideBadges
              throwLabel="Swipe up to send reply"
              unreadCount={0}
              // Repurposes the bottom-controls row's inbox slot as "cancel this reply" — the only
              // exit this card itself offers besides actually sending (the BottomNav dock below
              // can always back all the way out of the screen too).
              onOpenInbox={closeReplyCompose}
              onThrow={handleReplyThrow}
              onLaunched={closeReplyCompose}
            />
          </View>
        </View>
      ) : (
        <>
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

          <View style={{ position: 'absolute', left: 0, right: 0, bottom: s(v3Layout.chipRow.bottom, scale) + insets.bottom + BOTTOM_NAV_CLEARANCE }}>
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
        </>
      )}

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

      <View style={styles.bottomNavWrap}>
        <BottomNav
          activeId="throw"
          onSelect={(id) => {
            if (id === 'chat') onOpenChats();
            if (id === 'map') onOpenMap();
            if (id === 'games') onOpenGames();
            if (id === 'expenses') onOpenExpenses();
          }}
          onAdd={onOpenThrow}
          fabIconPath={BACK_ICON}
          fabAccessibilityLabel="Back"
          bottomInset={insets.bottom}
          reduceMotion={reduceMotion}
        />
      </View>
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
  bottomNavWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  // Mirrors ThrowHomeScreen's own `letterCardContent` (flex:1 inside the absolute-positioned,
  // explicitly-heighted card) — FoldingLetter measures its own paper size off this box via layout.
  replyCardContent: { flex: 1 },
});
