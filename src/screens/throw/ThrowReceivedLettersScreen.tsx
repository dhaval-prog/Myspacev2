import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThrowProvider, useThrow } from '../../context/ThrowContext';
import { Icon } from '../../components/Icon';
import { LetterPlaneGlyph } from '../../components/throw/inbox/LetterPlaneGlyph';
import { MapBackgroundV3 } from '../../components/throw/lettersV3/MapBackgroundV3';
import { ContactsRowV3 } from '../../components/throw/lettersV3/ContactsRowV3';
import { ToastV3 } from '../../components/throw/lettersV3/ToastV3';
import { LetterCardV3 } from '../../components/throw/lettersV3/LetterCardV3';
import { ActionRowV3 } from '../../components/throw/lettersV3/ActionRowV3';
import { ChipsRowV3 } from '../../components/throw/lettersV3/ChipsRowV3';
import { MediaViewerV3 } from '../../components/throw/lettersV3/MediaViewerV3';
import { useLettersArrivalV3, type V3Contact } from '../../hooks/useLettersArrivalV3';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { v3Color, v3Font, v3Layout } from '../../theme/throwLettersV3Tokens';

const BACK_ICON = 'M15 18l-6-6 6-6';

const s = (n: number, scale: number) => n * scale;

interface ThrowReceivedLettersScreenProps {
  onBack: () => void;
  /** Reply, after its own fold-away + fly-to-corner exit — the caller lands on the existing Throw
   * compose flow for this contact (no separate "ThrowCompose" route exists in this app; Throw's
   * own screen already composes in place once a contact is focused). */
  onReply: (contactId: string, throwId: string) => void;
  /** Preselects this contact — set when reached from a specific chat thread's own Throw icon. */
  initialContactId?: string;
}

function ReceivedLettersInner({ onBack, onReply, initialContactId }: ThrowReceivedLettersScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { friends, inbox, deleteThrow, markRead, confirmThrowAlert } = useThrow();
  const [frameWidth, setFrameWidth] = useState(0);
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

  if (contacts.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={[styles.backBtn, { top: insets.top + 8, left: 18 }]}>
          <Icon path={BACK_ICON} size={20} color={v3Color.ink} strokeWidth={2.2} />
        </Pressable>
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
      }}
    >
      <MapBackgroundV3 camTarget={arrival.camTarget} pins={arrival.pins} route={arrival.route} scale={scale} />

      <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={[styles.backBtn, { top: topOffset + 8, left: 18 }]}>
        <Icon path={BACK_ICON} size={20} color={v3Color.ink} strokeWidth={2.2} />
      </Pressable>

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

      <View style={{ position: 'absolute', left: s(v3Layout.letter.x, scale), top: topOffset + s(v3Layout.letter.y, scale) }}>
        <LetterCardV3 stage={arrival.stage} letter={arrival.cardData} isEmpty={arrival.isEmpty} emptyName={arrival.curContactName} scale={scale} />
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
  backBtn: {
    position: 'absolute',
    zIndex: 30,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyScreen: { flex: 1, backgroundColor: v3Color.mapBg, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: v3Font.ui800, fontSize: 18, color: v3Color.ink },
  emptySub: { fontFamily: v3Font.ui400, fontSize: 13.5, color: v3Color.mutedDark, textAlign: 'center' },
});
