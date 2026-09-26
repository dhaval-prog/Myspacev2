import React, { useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { FriendAvatar } from '../friends/FriendAvatar';
import { GlassSurface } from '../friends/GlassSurface';
import { Icon } from '../Icon';
import { ConfirmDialog } from '../ConfirmDialog';
import { throwColor, throwFont, throwGlass, throwRadius } from '../../theme/throwTokens';
import { isVideoUri } from '../../utils/media';
import type { ThrowLetter } from '../../types/throw';

const TRASH_ICON = 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 10.5v6.5M13.5 10.5v6.5';

// How far a row needs to swipe left before releasing reveals the delete button — same convention
// (and same discrete swap-at-release mechanism, no live-tracked translateX) as the "Needs
// attention" list's own swipe-to-delete.
const SWIPE_REVEAL_WIDTH = 72;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  return `${days}d`;
}

interface LetterCardProps {
  letter: ThrowLetter;
  onPress: () => void;
  onDelete: () => void;
}

/** One inbox row — same two-line shape (avatar, name + time, preview + unread) as the Chats
 * list in Orbit, restyled with Throw's own warm-paper tokens, plus swipe-to-reveal delete. */
export function LetterCard({ letter, onPress, onDelete }: LetterCardProps) {
  const [swiped, setSwiped] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const unread = letter.direction === 'received' && letter.status === 'thrown';
  const preview = letter.messageText
    ? letter.messageText
    : letter.photoUrls.length > 0
      ? letter.photoUrls.every(isVideoUri)
        ? 'Sent a video'
        : 'Sent a photo'
      : 'A handwritten letter';
  const nameLabel = letter.direction === 'sent' ? `To ${letter.counterpartName}` : letter.counterpartName;

  // Everything — tap-to-open, swipe-to-reveal — goes through this one PanResponder attached
  // directly to the row (no wrapping Pressable). A wrapping Pressable claims the touch responder
  // on its own before this PanResponder's onMoveShouldSetPanResponder ever gets a chance to see
  // the drag, since neither side declares a capture-phase handler to negotiate priority — the
  // exact bug this codebase already hit and solved once for the compose paper's own fold gesture
  // (see FoldingLetter's onMoveShouldSetPanResponderCapture). Simplest fix here: no Pressable at
  // all, and treat a release with barely any movement as a tap.
  const swipedRef = useRef(swiped);
  swipedRef.current = swiped;
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8) {
          if (swipedRef.current) setSwiped(false);
          else onPressRef.current();
          return;
        }
        if (g.dx < -SWIPE_REVEAL_WIDTH / 2) setSwiped(true);
        else if (g.dx > SWIPE_REVEAL_WIDTH / 2) setSwiped(false);
      },
    }),
  ).current;

  const confirmDelete = () => {
    setConfirmOpen(false);
    setSwiped(false);
    onDelete();
  };

  const cancelDelete = () => {
    setConfirmOpen(false);
    setSwiped(false);
  };

  return (
    <>
      <GlassSurface tint="light" tintColor={unread ? throwGlass.tintStrong : throwGlass.tint} style={[styles.row, unread && styles.rowUnread]} {...panResponder.panHandlers}>
        <FriendAvatar userId={letter.counterpartId} name={letter.counterpartName} avatarUrl={letter.counterpartAvatarUrl} size={48} initialsFontSize={16} />
        <View style={styles.rowText}>
          <View style={styles.rowNameLine}>
            <Text style={styles.rowName} numberOfLines={1}>
              {nameLabel}
            </Text>
            <Text style={styles.rowTime}>{timeAgo(letter.createdAt)}</Text>
          </View>
          <View style={styles.rowPreviewLine}>
            <Text style={[styles.rowPreview, unread && styles.rowPreviewUnread]} numberOfLines={1}>
              {preview}
            </Text>
            {unread && <View style={styles.unreadDot} />}
          </View>
        </View>
        {swiped && (
          <Pressable
            onPress={() => setConfirmOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Delete letter from ${letter.counterpartName}`}
            style={styles.deleteBtn}
          >
            <Icon path={TRASH_ICON} color="#fff" size={15} strokeWidth={1.8} />
          </Pressable>
        )}
      </GlassSurface>

      <ConfirmDialog
        visible={confirmOpen}
        title="Delete this letter?"
        message="This removes it from your Throw inbox. It can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: throwRadius.card,
    borderWidth: 1,
    borderColor: throwGlass.border,
  },
  rowUnread: { borderColor: throwColor.clay, borderWidth: 1.5 },
  rowText: { flex: 1, gap: 3, minWidth: 0 },
  rowNameLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  rowName: { flex: 1, fontFamily: throwFont.ui700, fontSize: 14.5, color: throwColor.ink },
  rowTime: { fontFamily: throwFont.mono, fontSize: 11, color: throwColor.inkMute },
  rowPreviewLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowPreview: { flex: 1, fontFamily: throwFont.hand500, fontSize: 15.5, color: throwColor.inkSoft },
  rowPreviewUnread: { color: throwColor.ink },
  unreadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: throwColor.unread },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#B3413A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
