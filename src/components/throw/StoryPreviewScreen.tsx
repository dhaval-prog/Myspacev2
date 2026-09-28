import React, { useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Icon } from '../Icon';
import { throwColor, throwRadius } from '../../theme/throwTokens';
import type { StoryMediaType } from '../../types/story';

const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';
const ARROW_ICON = 'M5 12h14M13 6l6 6-6 6';
const CONFIRM_SIZE = 56;
const FLIGHT_DURATION_MS = 480;
const MIN_SCALE = 0.12;
const MAX_TILT_DEG = 8;
// Used only until the real measurement below resolves, or as a last resort if flightTargetY is
// never given at all — same fallback ContactStoryStack's own flight distance has.
const DEFAULT_FLIGHT_DISTANCE = 260;

function PreviewVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <VideoView player={player as any} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} pointerEvents="none" />;
}

interface StoryPreviewScreenProps {
  localUri: string;
  mediaType: StoryMediaType;
  /** The selected contact's own ring in RecipientCarousel, in absolute screen coordinates (see
   * ThrowHomeScreen's own storyFlightTargetY) — the confirmed photo flies toward this exact point,
   * the same destination a consumed story card in ContactStoryStack flies to, so posting one reads
   * as "sending it up to the same place a story lives" rather than inventing a second effect. Falls
   * back to a fixed distance if omitted (tests, or before the first real layout pass resolves it). */
  flightTargetY?: number;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Shown right after the camera/gallery hands back a photo or short video, before it's actually
 * posted — replaces the compose letter in the same card, the same way StoryCaptureScreen/
 * ContactStoryStack do, rather than a separate full-screen takeover. The green circle + right-
 * arrow bottom-right (per explicit request with its own reference screenshot) is the only way to
 * actually post: tapping it shrinks, tilts, and fades the photo as it flies up toward the
 * contact's ring, and only once that flight finishes does onConfirm actually fire (see
 * ThrowHomeScreen's own handleStoryPreviewConfirmed) — the close button in the top-left discards
 * it immediately instead, with no such flourish.
 */
export function StoryPreviewScreen({ localUri, mediaType, flightTargetY, onCancel, onConfirm }: StoryPreviewScreenProps) {
  const [flying, setFlying] = useState(false);
  const wrapRef = useRef<View>(null);
  const flight = useRef(new Animated.Value(0)).current;
  // Read inside handleConfirm without needing to rebuild it on every relayout.
  const flightDistanceRef = useRef(DEFAULT_FLIGHT_DISTANCE);

  const onLayout = () => {
    if (flightTargetY == null) return;
    requestAnimationFrame(() => {
      wrapRef.current?.measureInWindow((_x, y, _width, height) => {
        const ownCenterY = y + height / 2;
        flightDistanceRef.current = Math.max(140, ownCenterY - flightTargetY);
      });
    });
  };

  const handleConfirm = () => {
    setFlying(true);
    Animated.timing(flight, {
      toValue: -flightDistanceRef.current,
      duration: FLIGHT_DURATION_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onConfirm());
  };

  const flightDistance = Math.max(1, flightDistanceRef.current);
  const mediaStyle = {
    transform: [
      { translateY: flight },
      { scale: flight.interpolate({ inputRange: [-flightDistance, 0], outputRange: [MIN_SCALE, 1], extrapolate: 'clamp' as const }) },
      { rotate: flight.interpolate({ inputRange: [-flightDistance, 0], outputRange: [`-${MAX_TILT_DEG}deg`, '0deg'], extrapolate: 'clamp' as const }) },
    ],
    opacity: flight.interpolate({ inputRange: [-flightDistance, -flightDistance * 0.82, 0], outputRange: [0, 1, 1], extrapolate: 'clamp' as const }),
  };

  return (
    <View ref={wrapRef} onLayout={onLayout} style={styles.root}>
      <Animated.View style={[styles.card, mediaStyle]}>
        {mediaType === 'photo' ? (
          <Image source={{ uri: localUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <PreviewVideo uri={localUri} />
        )}
      </Animated.View>

      {!flying && (
        <>
          <Pressable onPress={onCancel} hitSlop={12} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Discard">
            <Icon path={CLOSE_ICON} size={22} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>

          <Pressable onPress={handleConfirm} hitSlop={12} style={styles.confirmBtn} accessibilityRole="button" accessibilityLabel="Post to your story">
            <Icon path={ARROW_ICON} size={26} color="#FFFFFF" strokeWidth={2.6} />
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // No overflow constraint here — the card needs to be able to visually travel up past its own
  // resting bounds toward the contact's ring once confirmed; `card` itself (individually rounded)
  // clips only its own photo content.
  root: { flex: 1, position: 'relative' },
  card: { ...StyleSheet.absoluteFill, borderRadius: throwRadius.paper, overflow: 'hidden', backgroundColor: '#000000' },
  closeBtn: {
    position: 'absolute',
    top: 12,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtn: {
    position: 'absolute',
    bottom: 16,
    right: 24,
    width: CONFIRM_SIZE,
    height: CONFIRM_SIZE,
    borderRadius: CONFIRM_SIZE / 2,
    backgroundColor: throwColor.storyRing,
    alignItems: 'center',
    justifyContent: 'center',
    ...throwColor.shadowSoft,
  },
});
