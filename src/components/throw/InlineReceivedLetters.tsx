import React, { useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LetterPlaneGlyph } from './inbox/LetterPlaneGlyph';
import { ToastV3 } from './lettersV3/ToastV3';
import { LetterCardV3 } from './lettersV3/LetterCardV3';
import { ActionRowV3 } from './lettersV3/ActionRowV3';
import { ChipsRowV3 } from './lettersV3/ChipsRowV3';
import { MediaViewerV3 } from './lettersV3/MediaViewerV3';
import { useLettersArrivalV3, type V3Contact } from '../../hooks/useLettersArrivalV3';
import { v3Layout } from '../../theme/throwLettersV3Tokens';
import { noSelect } from '../../theme/webStyles';
import type { AlertSchedule } from '../../types/throw';

const s = (n: number, scale: number) => n * scale;

interface InlineReceivedLettersProps {
  contacts: V3Contact[];
  initialContactId?: string;
  reduceMotion: boolean;
  /** Design-units-to-pixels scale, same as ThrowReceivedLettersScreen's own (windowWidth /
   * v3Layout.phone.width) — this inline panel reuses that screen's own token-driven geometry
   * directly rather than re-deriving its own. */
  scale: number;
  deleteThrow: (throwId: string) => Promise<{ error: string | null }>;
  markRead: (throwId: string) => Promise<void>;
  confirmThrowAlert: (throwId: string, schedule: AlertSchedule) => Promise<{ error: string | null }>;
  /** Fires when Reply finishes its own fold-away exit — ThrowHomeScreen's own compose letter for
   * this same contact is already sitting right underneath, so "reply" here just means closing
   * this panel back to it, not a navigation. */
  onClose: () => void;
  /** insets.top — everything below positions itself relative to this, same convention
   * ThrowReceivedLettersScreen's own topOffset uses. */
  topOffset: number;
  /** Where the bottom chip row's own `bottom` lands — ThrowHomeScreen's own BOTTOM_NAV_CLEARANCE-
   * aware offset (its BottomNav dock has no equivalent on the standalone screen, which is why this
   * isn't just v3Layout.chipRow.bottom + insets.bottom the way that screen does it), animated down
   * to just the safe-area inset as that dock fades out behind this panel (same chromeOpacity-driven
   * interpolation the letter card's own bottom edge uses). */
  chipRowBottom: number | Animated.AnimatedAddition<number>;
}

/**
 * ThrowHomeScreen's own in-place "received letters" mode (see its own isReceivingSelected) — the
 * same wax-seal arrival sequence (plane lands, envelope opens, letter rises) and chip-switch-
 * between-letters row the standalone ThrowReceivedLettersScreen uses, mounted inline over the
 * compose letter's own map instead of navigating to a separate screen/map, per explicit request.
 * Deliberately omits ContactsRowV3 (the contact picker) and ThrowMap — ThrowHomeScreen's own
 * RecipientCarousel/map already own "which friend" and "what's behind this", so this only ever
 * shows whichever contact is already selected there; switching friends in the carousel closes this
 * panel back to compose (see ThrowHomeScreen's own onChangeIndex).
 */
export function InlineReceivedLetters({
  contacts,
  initialContactId,
  reduceMotion,
  scale,
  deleteThrow,
  markRead,
  confirmThrowAlert,
  onClose,
  topOffset,
  chipRowBottom,
}: InlineReceivedLettersProps) {
  const [mediaOpen, setMediaOpen] = useState(false);
  const [armed, setArmed] = useState(false);

  const arrival = useLettersArrivalV3({
    contacts,
    initialContactId,
    reduceMotion,
    scale,
    deleteThrow,
    markRead,
    confirmThrowAlert,
    onReply: onClose,
    // The user just tapped to open this (same reasoning as the incoming-letter toast's own
    // viaToast) — the plane should start flying in right away, not after an unrelated extra pause.
    skipLeadIn: true,
  });

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
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

      <View style={[{ position: 'absolute', left: s(v3Layout.letter.x, scale), top: topOffset + s(v3Layout.letter.y, scale) }, noSelect]} pointerEvents="box-none">
        <LetterCardV3 stage={arrival.stage} letter={arrival.cardData} isEmpty={arrival.isEmpty} emptyName={arrival.curContactName} scale={scale} />
      </View>

      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', left: s(v3Layout.actionRow.x, scale), right: s(v3Layout.actionRow.x, scale), top: topOffset + s(v3Layout.actionRow.y, scale) }}
      >
        <ActionRowV3
          visible={arrival.stage === 'open' && !armed && !mediaOpen}
          letter={arrival.cardData}
          onReply={arrival.reply}
          onConfirm={arrival.confirmAlert}
          onOpenMedia={() => setMediaOpen(true)}
          scale={scale}
        />
      </View>

      <Animated.View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: chipRowBottom }}>
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
      </Animated.View>

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
