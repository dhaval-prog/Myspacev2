import React, { useEffect, useRef, useState } from 'react';
import { AppState, Animated, Easing, Image, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import Svg, { Circle } from 'react-native-svg';
import { Icon } from '../Icon';
import { ContactStoryStack } from './ContactStoryStack';
import { useStatusCamera } from './useStatusCamera';
import { useCarouselSurface, tentDeviation, type CarouselPosCore } from '../../hooks/useCarouselPos';
import { AVATAR_SIZE } from './RecipientCarousel';
import { throwColor } from '../../theme/throwTokens';
import type { StoryMediaType, ThrowStory } from '../../types/story';

// How many px of drag equals one whole contact on the letter surface — matches the interaction
// spec's own "swiping on the letter moves one contact per 390px" (the card's own width).
const LETTER_SPACING = 390;
const CORNER_RADIUS = 28;
const HOLD_THRESHOLD_MS = 260;
const MAX_VIDEO_MS = 15000;
const MIN_VIDEO_MS = 1000;
const RED_PILL_AFTER_MS = 12000;
const FLASH_DURATION_MS = 350;
const ADD_TO_STATUS_MS = 500;
const ADD_TO_STATUS_EASING = Easing.bezier(0.5, 0, 0.2, 1);
// Starts the camera stream while still swiping *toward* "You" (index -1), so the preview is
// already live by the time the panel actually lands — matches the spec's own `pos < 1.7`.
const PREWARM_POS_THRESHOLD = 1.7;
const COOL_DELAY_MS = 5000;
const PROG_RADIUS = 38;
const PROG_CIRCUMFERENCE = 2 * Math.PI * PROG_RADIUS;

const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';
const FLIP_ICON = 'M4 4v5h5 M20 20v-5h-5 M4 9a8 8 0 0114-4.9L20 9 M20 15a8 8 0 01-14 4.9L4 15';
const GALLERY_ICON = 'M4 8h4l1.6-2.5h4.8L16 8h4v11H4z M12 11.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z';
const UP_ARROW_ICON = 'M12 19V5M5 12l7-7 7 7';
const CAMERA_OFF_ICON = 'M1 1l22 22 M9 5H7L4 7v10a2 2 0 002 2h11l-2-2H6a1 1 0 01-1-1V8l1.17-1.5 M15 5h1l2.2 3H21a2 2 0 012 2v9.5';

// A tiny neutral placeholder — used only as the *captured* media when the real camera is denied
// (the interaction spec's own "camera blocked · sample preview" fallback); the on-screen fallback
// itself is a plain icon/gradient, not this image, since react-native-web's Image component
// doesn't reliably render data: URIs — but `postStory` only ever needs a fetchable URI, which a
// data: URI still is.
const SAMPLE_IMAGE_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function fmt(ms: number): string {
  return '0:' + String(Math.floor(ms / 1000)).padStart(2, '0');
}

interface CapturedMedia {
  localUri: string;
  mediaType: StoryMediaType;
  durationMs?: number;
  trim?: { startMs: number; endMs: number };
}

function ReviewVideo({ uri, capMs }: { uri: string; capMs?: number }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = capMs == null;
    p.muted = true;
    p.play();
  });
  useEffect(() => {
    if (capMs == null) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = (player as any).addListener('timeUpdate', ({ currentTime }: { currentTime: number }) => {
      if (currentTime * 1000 >= capMs) player.currentTime = 0;
    });
    return () => sub.remove();
  }, [player, capMs]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <VideoView player={player as any} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} pointerEvents="none" />;
}

interface MyStatusPanelProps {
  core: CarouselPosCore;
  flightTargetX: number;
  flightTargetY: number;
  isNight?: boolean;
  stories: ThrowStory[];
  dropSignal: number;
  onViewed?: (storyId: string) => void;
  onDeleteStory?: (storyId: string) => void;
  onAvatarCountChange?: (count: number) => void;
  onPulseAvatar?: () => void;
  postStory: (localUri: string, mediaType: StoryMediaType, trim?: { startMs: number; endMs: number }) => Promise<{ error: string | null }>;
  /** ✕ top-left — goes back to whichever real contact was selected before "You". */
  onClose: () => void;
}

/**
 * "You"'s own always-mounted letter panel — a live camera (pre-warmed while still swiping toward
 * it, stopped 5s after leaving or when the app backgrounds), capture → inline review → "Add to
 * status" (which shrinks the reviewed card into the avatar), and, layered on top, the exact same
 * ContactStoryStack any other contact's posted status uses for your own. Slides with the shared
 * `core.pos` exactly like the recipient rail's own avatars — see useCarouselPos.
 */
export function MyStatusPanel({
  core,
  flightTargetX,
  flightTargetY,
  isNight,
  stories,
  dropSignal,
  onViewed,
  onDeleteStory,
  onAvatarCountChange,
  onPulseAvatar,
  postStory,
  onClose,
}: MyStatusPanelProps) {
  const camera = useStatusCamera();
  const { ref: letterRef, panHandlers } = useCarouselSurface(core, LETTER_SPACING);
  const [rect, setRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const measure = () => {
    requestAnimationFrame(() => {
      letterRef.current?.measureInWindow((x, y, width, height) => setRect({ x, y, width, height }));
    });
  };
  useEffect(measure, [flightTargetX, flightTargetY]);

  const [letterCount, setLetterCount] = useState(0);
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const recordingRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const coolTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordStartRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recProgress = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const morphProgress = useRef(new Animated.Value(1)).current;
  const discMorph = useRef(new Animated.Value(0)).current;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 1800);
  };

  // Pre-warm while still swiping toward "You" (see PREWARM_POS_THRESHOLD) — a plain value
  // listener, not React state, so this never causes a re-render mid-swipe.
  useEffect(() => {
    const id = core.pos.addListener(({ value }) => {
      if (value < PREWARM_POS_THRESHOLD) camera.warm();
    });
    return () => core.pos.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core.pos]);

  // Stops 5s after actually leaving "You" (not while still recording) — matches the spec's own
  // "turn the camera off 5s after leaving 'You'".
  useEffect(() => {
    if (core.index === -1) {
      if (coolTimerRef.current) {
        clearTimeout(coolTimerRef.current);
        coolTimerRef.current = null;
      }
      camera.warm();
      return;
    }
    coolTimerRef.current = setTimeout(() => {
      if (!recordingRef.current) camera.cool();
    }, COOL_DELAY_MS);
    return () => {
      if (coolTimerRef.current) clearTimeout(coolTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core.index]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') camera.cool();
      else if (core.index === -1) camera.warm();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      if (coolTimerRef.current) clearTimeout(coolTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      // Animated.timing keeps running independently of React's own lifecycle — without stopping
      // these explicitly, an in-flight one's completion callback (which calls back into
      // setState) can still fire after this component is gone.
      recProgress.stopAnimation();
      flashOpacity.stopAnimation();
      morphProgress.stopAnimation();
      discMorph.stopAnimation();
    },
    [],
  );

  const flash = () => {
    flashOpacity.setValue(0.85);
    Animated.timing(flashOpacity, { toValue: 0, duration: FLASH_DURATION_MS, useNativeDriver: true }).start();
  };

  const takePhotoNow = async () => {
    flash();
    Vibration.vibrate(8);
    if (camera.denied) {
      setCapturedMedia({ localUri: SAMPLE_IMAGE_URI, mediaType: 'photo' });
      return;
    }
    const uri = await camera.takePhoto();
    if (uri) setCapturedMedia({ localUri: uri, mediaType: 'photo' });
  };

  const finishRecording = async (auto: boolean) => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setRecording(false);
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
    recProgress.stopAnimation();
    Animated.timing(discMorph, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    const result = await camera.stopRecording();
    if (auto) {
      Vibration.vibrate([10, 40, 10]);
      showToast('15s max reached');
    }
    if (result) {
      const durationMs = Math.max(MIN_VIDEO_MS, Math.min(MAX_VIDEO_MS, result.durationMs));
      setCapturedMedia({ localUri: result.uri, mediaType: 'video', durationMs });
    }
  };

  const beginRecording = () => {
    if (!camera.canRecordVideo || !camera.live) return;
    recordingRef.current = true;
    setRecording(true);
    recordStartRef.current = performance.now();
    setElapsedMs(0);
    camera.startRecording();
    Vibration.vibrate(14);
    Animated.timing(discMorph, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    recProgress.setValue(0);
    Animated.timing(recProgress, { toValue: 1, duration: MAX_VIDEO_MS, easing: Easing.linear, useNativeDriver: false }).start();
    elapsedIntervalRef.current = setInterval(() => setElapsedMs(performance.now() - recordStartRef.current), 100);
    autoStopTimerRef.current = setTimeout(() => finishRecording(true), MAX_VIDEO_MS);
  };

  const onShutterPressIn = () => {
    // No hold-to-record timer at all when video isn't supported — but a plain tap must still
    // take a photo (see onShutterPressOut's own fallback below), not silently do nothing.
    if (!camera.canRecordVideo) return;
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      beginRecording();
    }, HOLD_THRESHOLD_MS);
  };
  const onShutterPressOut = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      void takePhotoNow();
      return;
    }
    if (recordingRef.current) {
      void finishRecording(false);
      return;
    }
    if (!camera.canRecordVideo) void takePhotoNow();
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.9 });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    if (asset.type === 'video') {
      const durationMs = asset.duration ?? 0;
      if (durationMs > MAX_VIDEO_MS) {
        showToast('Trimmed to the first 15s');
        setCapturedMedia({ localUri: asset.uri, mediaType: 'video', durationMs: MAX_VIDEO_MS, trim: { startMs: 0, endMs: MAX_VIDEO_MS } });
        return;
      }
      setCapturedMedia({ localUri: asset.uri, mediaType: 'video', durationMs });
      return;
    }
    setCapturedMedia({ localUri: asset.uri, mediaType: 'photo' });
  };

  const handleRetake = () => setCapturedMedia(null);

  const handleAddToStatus = () => {
    const media = capturedMedia;
    if (!media) return;
    Animated.timing(morphProgress, { toValue: 0, duration: ADD_TO_STATUS_MS, easing: ADD_TO_STATUS_EASING, useNativeDriver: false }).start(() => {
      morphProgress.setValue(1);
      setCapturedMedia(null);
      onPulseAvatar?.();
      showToast('Added to your status');
      Vibration.vibrate(10);
    });
    void postStory(media.localUri, media.mediaType, media.trim).then((res) => {
      if (res.error) showToast(res.error);
    });
  };

  // Letter-track transform — the same `translateX((i-pos)*390) scale(1-0.08|d|) opacity(1-0.5|d|)`
  // formula the spec gives, at i = -1 (this is always the leftmost panel).
  const { d, a } = tentDeviation(core.pos, -1);
  const translateX = Animated.multiply(d, LETTER_SPACING);
  const trackScale = a.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] });
  const trackOpacity = a.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] });

  const cardW = rect?.width ?? 300;
  const cardH = rect?.height ?? 260;
  const avatarLocalX = rect ? flightTargetX - rect.x : cardW / 2;
  const avatarLocalY = rect ? flightTargetY - rect.y : cardH / 2;
  const morphWidth = morphProgress.interpolate({ inputRange: [0, 1], outputRange: [AVATAR_SIZE, cardW] });
  const morphHeight = morphProgress.interpolate({ inputRange: [0, 1], outputRange: [AVATAR_SIZE, cardH] });
  const morphCenterX = morphProgress.interpolate({ inputRange: [0, 1], outputRange: [avatarLocalX, cardW / 2] });
  const morphCenterY = morphProgress.interpolate({ inputRange: [0, 1], outputRange: [avatarLocalY, cardH / 2] });
  const morphLeft = Animated.subtract(morphCenterX, Animated.divide(morphWidth, 2));
  const morphTop = Animated.subtract(morphCenterY, Animated.divide(morphHeight, 2));
  const morphRadius = morphProgress.interpolate({ inputRange: [0, 1], outputRange: [AVATAR_SIZE / 2, CORNER_RADIUS] });
  const morphOpacity = morphProgress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' });

  const discSize = discMorph.interpolate({ inputRange: [0, 1], outputRange: [64, 30] });
  const discRadius = discMorph.interpolate({ inputRange: [0, 1], outputRange: [32, 8] });
  const progDashoffset = recProgress.interpolate({ inputRange: [0, 1], outputRange: [PROG_CIRCUMFERENCE, 0] });
  const hot = elapsedMs > RED_PILL_AFTER_MS;

  const showCamUI = !capturedMedia;
  const showSideButtons = showCamUI && !recording;

  return (
    <Animated.View style={[styles.track, { transform: [{ translateX }, { scale: trackScale }], opacity: trackOpacity }]}>
      <View ref={letterRef} onLayout={measure} style={styles.cardWrap} {...panHandlers}>
        <View style={styles.cardBox}>
            {camera.denied ? (
              <View style={styles.deniedFallback}>
                <Icon path={CAMERA_OFF_ICON} size={40} color="rgba(255,255,255,.5)" strokeWidth={1.6} />
              </View>
            ) : (
              camera.renderPreview()
            )}
            {camera.denied && (
              <View style={styles.camNote}>
                <Text style={styles.camNoteText}>Camera blocked · sample preview</Text>
              </View>
            )}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flashOpacity }]} />

            {recording && (
              <View style={[styles.recPill, hot && styles.recPillHot]}>
                <View style={styles.recDot} />
                <Text style={styles.recPillText}>{fmt(elapsedMs)}</Text>
                <Text style={styles.recPillMax}>/ 0:15</Text>
              </View>
            )}

            {showCamUI && (
              <>
                <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close camera">
                  <Icon path={CLOSE_ICON} size={20} color="#FFFFFF" strokeWidth={2.2} />
                </Pressable>
                {showSideButtons && (
                  <Pressable onPress={camera.flip} hitSlop={12} style={styles.flipBtn} accessibilityRole="button" accessibilityLabel="Flip camera">
                    <Icon path={FLIP_ICON} size={22} color="#FFFFFF" strokeWidth={1.9} />
                  </Pressable>
                )}
                {showSideButtons && (
                  <Pressable
                    onPress={pickFromGallery}
                    hitSlop={12}
                    style={styles.galleryBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Choose photo or video from library"
                  >
                    <Icon path={GALLERY_ICON} size={21} color="#FFFFFF" strokeWidth={1.8} />
                  </Pressable>
                )}
                <Pressable
                  onPressIn={onShutterPressIn}
                  onPressOut={onShutterPressOut}
                  style={styles.shutter}
                  accessibilityRole="button"
                  accessibilityLabel={camera.canRecordVideo ? 'Hold to record video, tap for a photo' : 'Take a photo'}
                >
                  <Svg width={84} height={84} style={[styles.shutterSvg]}>
                    <Circle cx={42} cy={42} r={PROG_RADIUS} fill="none" stroke="#FFFFFF" strokeWidth={4} />
                    <AnimatedCircle
                      cx={42}
                      cy={42}
                      r={PROG_RADIUS}
                      fill="none"
                      stroke="#FF3B30"
                      strokeWidth={4.5}
                      strokeLinecap="round"
                      strokeDasharray={PROG_CIRCUMFERENCE}
                      strokeDashoffset={progDashoffset}
                    />
                  </Svg>
                  <Animated.View style={[styles.shutterInner, { width: discSize, height: discSize, borderRadius: discRadius }]} />
                </Pressable>
              </>
            )}

            {capturedMedia && (
              <Animated.View
                style={[
                  styles.morphBox,
                  { left: morphLeft, top: morphTop, width: morphWidth, height: morphHeight, borderRadius: morphRadius, opacity: morphOpacity },
                ]}
              >
                {capturedMedia.mediaType === 'photo' ? (
                  <Image source={{ uri: capturedMedia.localUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <ReviewVideo uri={capturedMedia.localUri} capMs={capturedMedia.trim ? capturedMedia.trim.endMs : undefined} />
                )}
                <Pressable onPress={handleRetake} hitSlop={12} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Retake">
                  <Icon path={CLOSE_ICON} size={20} color="#FFFFFF" strokeWidth={2.2} />
                </Pressable>
                {capturedMedia.mediaType === 'video' && (
                  <View style={styles.durationChip}>
                    <Text style={styles.durationChipText}>{fmt(capturedMedia.durationMs ?? 0)} / 0:15</Text>
                  </View>
                )}
                <Pressable onPress={handleAddToStatus} style={styles.addPill} accessibilityRole="button" accessibilityLabel="Add to your status">
                  <Text style={styles.addPillText}>Add to status</Text>
                  <Icon path={UP_ARROW_ICON} size={18} color={throwColor.ink} strokeWidth={2.2} />
                </Pressable>
              </Animated.View>
            )}

            <View pointerEvents={letterCount > 0 ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
              <ContactStoryStack
                stories={stories}
                isNight={isNight}
                contactName="You"
                flightTargetX={flightTargetX}
                flightTargetY={flightTargetY}
                dropSignal={dropSignal}
                onViewed={onViewed}
                isOwnStories
                onDeleteStory={onDeleteStory}
                onAvatarCountChange={onAvatarCountChange}
                onPulseAvatar={onPulseAvatar}
                onLetterCountChange={setLetterCount}
                hideEmptyState
              />
            </View>
          </View>

        {toastMsg && (
          <View style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toastMsg}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// react-native-svg's Circle doesn't get an Animated wrapper out of the box the way core RN
// components do.
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const styles = StyleSheet.create({
  track: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  cardWrap: { flex: 1, position: 'relative' },
  cardBox: { ...StyleSheet.absoluteFill, borderRadius: CORNER_RADIUS, overflow: 'hidden', backgroundColor: '#1B1A19', ...throwColor.shadowSoft },
  deniedFallback: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B1A19' },
  camNote: {
    position: 'absolute',
    top: 22,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  camNoteText: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,.55)',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    overflow: 'hidden',
  },
  flash: { backgroundColor: '#FFFFFF' },
  closeBtn: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(70,70,70,.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(70,70,70,.62)',
    borderWidth: 2.5,
    borderColor: '#7FA2F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryBtn: {
    position: 'absolute',
    left: 24,
    bottom: 22,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(70,70,70,.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: { position: 'absolute', left: '50%', bottom: 12, marginLeft: -42, width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  shutterSvg: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
  shutterInner: { backgroundColor: '#FFFFFF' },
  recPill: {
    position: 'absolute',
    top: 22,
    left: '50%',
    marginLeft: -46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,.55)',
  },
  recPillHot: { backgroundColor: 'rgba(255,59,48,.85)' },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' },
  recPillText: { color: '#FFFFFF', fontSize: 12, fontVariant: ['tabular-nums'] },
  recPillMax: { color: 'rgba(255,255,255,.6)', fontSize: 12 },
  morphBox: { position: 'absolute', overflow: 'hidden', backgroundColor: '#111111' },
  durationChip: {
    position: 'absolute',
    right: 14,
    top: 22,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,.55)',
  },
  durationChipText: { color: '#FFFFFF', fontSize: 11.5 },
  addPill: {
    position: 'absolute',
    right: 14,
    bottom: 16,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...throwColor.shadowSoft,
  },
  addPillText: { color: throwColor.ink, fontSize: 14, fontWeight: '800' },
  toast: {
    position: 'absolute',
    left: '50%',
    bottom: 96,
    marginLeft: -80,
    width: 160,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: throwColor.ink,
    alignItems: 'center',
  },
  toastText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
