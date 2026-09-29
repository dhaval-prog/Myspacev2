import React, { useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { AutoplayVideoFill } from '../AutoplayVideoFill';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
import type { StoryMediaType } from '../../types/story';

const PLUS_ICON = 'M12 5v14M5 12h14';
const FLIGHT_DURATION_MS = 480;
const MIN_SCALE = 0.12;
const MAX_TILT_DEG = 8;
// Used only until the real measurement below resolves, or as a last resort if flightTargetY is
// never given at all — same fallback ContactStoryStack's own flight distance has.
const DEFAULT_FLIGHT_DISTANCE = 260;

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
 * ContactStoryStack do, rather than a separate full-screen takeover. Two pill buttons along the
 * bottom (per explicit request with its own reference screenshot): "Retake" on the left discards
 * immediately and reopens the camera (see ThrowHomeScreen's own onCancel wiring), "Add to status"
 * on the right is the only way to actually post — tapping it shrinks, tilts, and fades the photo
 * as it flies up toward the contact's ring, and only once that flight finishes does onConfirm
 * actually fire (see ThrowHomeScreen's own handleStoryPreviewConfirmed).
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
          <AutoplayVideoFill uri={localUri} />
        )}
      </Animated.View>

      {!flying && (
        <View style={styles.bottomRow}>
          <Pressable onPress={onCancel} hitSlop={10} style={styles.retakeBtn} accessibilityRole="button" accessibilityLabel="Retake">
            <Text style={styles.retakeText}>Retake</Text>
          </Pressable>

          <Pressable onPress={handleConfirm} hitSlop={10} style={styles.confirmBtn} accessibilityRole="button" accessibilityLabel="Add to status">
            <View style={styles.confirmIconWrap}>
              <Icon path={PLUS_ICON} size={14} color="#FFFFFF" strokeWidth={2.6} />
            </View>
            <Text style={styles.confirmText}>Add to status</Text>
          </Pressable>
        </View>
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
  bottomRow: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  retakeBtn: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(60,58,54,.65)',
  },
  retakeText: { color: '#FFFFFF', fontSize: 15, fontFamily: throwFont.ui600 },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    ...throwColor.shadowSoft,
  },
  confirmIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: throwColor.storyRing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { color: '#1A1A1A', fontSize: 15, fontFamily: throwFont.ui700 },
});
