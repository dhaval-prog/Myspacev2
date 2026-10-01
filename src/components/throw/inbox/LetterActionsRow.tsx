import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GlassIconButton } from './LetterFoldCard';
import { formatAlertSchedule } from '../../../utils/throwAlerts';
import type { AlertSchedule } from '../../../types/throw';

const IMAGE_ICON = 'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M21 15l-5-5L5 21';

interface LetterActionsRowProps {
  onThrowBack: () => void;
  alertSchedule: AlertSchedule | null;
  alertConfirmed: boolean;
  onConfirmAlert?: () => void;
  hasMedia: boolean;
  onTogglePhotos: () => void;
  scale: number;
}

/** Reply/Confirm/photo — the in-place received-letters panel's own per-letter action row, a plain
 * flow sibling below LetterFoldCard (see ThrowHomeScreen's own inboxCardHeight, which reserves
 * this row's height out of the panel so the two never overlap) rather than floating on top of the
 * letter's own written text the way it originally did. Shares LetterFoldCard's own glass button
 * chrome (GlassIconButton) so it still reads as part of the same control family. */
export function LetterActionsRow({ onThrowBack, alertSchedule, alertConfirmed, onConfirmAlert, hasMedia, onTogglePhotos, scale }: LetterActionsRowProps) {
  const s = (n: number) => n * scale;
  return (
    <View style={[styles.wrap, { gap: s(12) }]}>
      <GlassIconButton onPress={onThrowBack} label="Reply" scale={scale} accessibilityLabel="Reply" tintColor="rgba(47,107,255,.55)" />
      {/* Only shows once there's actually a reminder request to confirm, and disappears once
          confirmed (same "this letter needs your action" convention as Reply, not a locked/dimmed
          state like the photo button below, since a confirmed request has nothing left to do
          here). */}
      {alertSchedule && !alertConfirmed && onConfirmAlert && (
        <GlassIconButton onPress={onConfirmAlert} label="Confirm" scale={scale} accessibilityLabel={`Confirm reminder, ${formatAlertSchedule(alertSchedule)}`} tintColor="rgba(47,169,107,.6)" />
      )}
      {/* Locked (no onPress, dimmed) rather than hidden when the letter has no attachments — per
          explicit request — so its presence itself says "this letter has no media" instead of the
          row just quietly having one fewer button. */}
      <GlassIconButton
        onPress={hasMedia ? onTogglePhotos : undefined}
        path={IMAGE_ICON}
        scale={scale}
        accessibilityLabel="View attached photos or videos"
        disabled={!hasMedia}
        tintColor="rgba(47,107,255,.55)"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
