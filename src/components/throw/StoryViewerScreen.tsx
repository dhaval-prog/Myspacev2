import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Icon } from '../Icon';
import { throwFont } from '../../theme/throwTokens';
import type { ThrowStory } from '../../types/story';

const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';
const PHOTO_DURATION_MS = 5000;
// How often to poll the video player's currentTime for the trim-window end — expo-video's player
// doesn't expose a plain per-frame "timeUpdate" event to key off instead (same "no reliable
// end event, so poll on a timer" reasoning as WheelPicker's own scroll-settle timer).
const VIDEO_POLL_MS = 200;

interface StoryViewerScreenProps {
  authorName: string;
  /** Oldest-first — the order they're played back in. */
  stories: ThrowStory[];
  onClose: () => void;
  /** Fired once, right as each story starts showing. */
  onViewed: (storyId: string) => void;
}

function StoryVideo({ story, onEnded }: { story: ThrowStory; onEnded: () => void }) {
  const player = useVideoPlayer(story.mediaUrl, (p) => {
    p.loop = false;
    p.currentTime = (story.trimStartMs ?? 0) / 1000;
    p.play();
  });

  useEffect(() => {
    const endMs = story.trimEndMs;
    const poll = setInterval(() => {
      const nowMs = player.currentTime * 1000;
      const hitTrimEnd = endMs != null && nowMs >= endMs;
      const hitNaturalEnd = endMs == null && player.duration > 0 && nowMs >= player.duration * 1000 - 150;
      if (hitTrimEnd || hitNaturalEnd) onEnded();
    }, VIDEO_POLL_MS);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  // See StoryTrimScreen's own comment on this same cast — expo-video's .d.ts/.web.d.ts split
  // resolves inconsistently under this project's moduleSuffixes, not a real type mismatch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <VideoView player={player as any} style={styles.media} contentFit="contain" nativeControls={false} />;
}

/**
 * Full-screen story playback for one contact — auto-advances through their active stories
 * (oldest first), photos holding for a fixed 5s and videos playing to their natural end (or the
 * end of their trim window, see StoryTrimScreen). Tap the right two-thirds of the screen to skip
 * ahead, the left third to go back; closes itself once the last story finishes.
 */
export function StoryViewerScreen({ authorName, stories, onClose, onViewed }: StoryViewerScreenProps) {
  const [index, setIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const photoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const story = stories[index];

  const goTo = (next: number) => {
    if (next < 0) return;
    if (next >= stories.length) {
      onClose();
      return;
    }
    setIndex(next);
  };

  useEffect(() => {
    if (!story) return;
    onViewed(story.id);
    progress.setValue(0);
    if (photoTimerRef.current) clearTimeout(photoTimerRef.current);

    if (story.mediaType === 'photo') {
      Animated.timing(progress, { toValue: 1, duration: PHOTO_DURATION_MS, useNativeDriver: false }).start();
      photoTimerRef.current = setTimeout(() => goTo(index + 1), PHOTO_DURATION_MS);
    } else {
      const durationMs = story.trimEndMs != null ? story.trimEndMs - (story.trimStartMs ?? 0) : undefined;
      if (durationMs) Animated.timing(progress, { toValue: 1, duration: durationMs, useNativeDriver: false }).start();
    }
    return () => {
      if (photoTimerRef.current) clearTimeout(photoTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, story?.id]);

  if (!story) return null;

  return (
    <View style={styles.screen}>
      <View style={styles.progressRow}>
        {stories.map((s, i) => (
          <View key={s.id} style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                i < index ? { width: '100%' } : i > index ? { width: '0%' } : { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}
            />
          </View>
        ))}
      </View>

      <Text style={styles.author} numberOfLines={1}>
        {authorName}
      </Text>
      <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close story">
        <Icon path={CLOSE_ICON} size={22} color="#FFFFFF" strokeWidth={2.2} />
      </Pressable>

      {story.mediaType === 'photo' ? (
        <Image source={{ uri: story.mediaUrl }} style={styles.media} resizeMode="contain" />
      ) : (
        <StoryVideo key={story.id} story={story} onEnded={() => goTo(index + 1)} />
      )}

      <View style={styles.tapZones} pointerEvents="box-none">
        <Pressable style={styles.tapLeft} onPress={() => goTo(index - 1)} accessibilityRole="button" accessibilityLabel="Previous story" />
        <Pressable style={styles.tapRight} onPress={() => goTo(index + 1)} accessibilityRole="button" accessibilityLabel="Next story" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  progressRow: { position: 'absolute', top: 16, left: 12, right: 12, flexDirection: 'row', gap: 4, zIndex: 2 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.3)', overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: '#FFFFFF' },
  author: { position: 'absolute', top: 30, left: 14, fontFamily: throwFont.ui700, fontSize: 14, color: '#FFFFFF', zIndex: 2 },
  closeBtn: { position: 'absolute', top: 22, right: 14, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  media: { flex: 1 },
  tapZones: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  tapLeft: { flex: 1 },
  tapRight: { flex: 2 },
});
