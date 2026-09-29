import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '../Icon';
import { throwRadius } from '../../theme/throwTokens';
import type { StoryMediaType } from '../../types/story';

const HOLD_THRESHOLD_MS = 220;
const MAX_VIDEO_MS = 15000;

// Purely cosmetic polish on top of the existing capture flow — see the native sibling's own
// comment on the same constants (no change to tap/hold thresholds, recording behavior, or
// gestures above/below).
const ENTER_MS = 220;
const EXIT_MS = 200;
const SHUTTER_PRESS_SCALE = 0.88;
const SHUTTER_SCALE_MS = 110;
const FLASH_MS = 160;
const SHUTTER_SIZE = 74;
// A thin ring drawn just outside the shutter, filling clockwise over the 15s cap while recording
// — same as the native sibling's own ring (see its comment).
const RING_SIZE = SHUTTER_SIZE + 16;
const RING_THICKNESS = 3;
const RING_RADIUS = (RING_SIZE - RING_THICKNESS) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Same thresholds/spacing FoldingLetter's own writing-phase contact flick uses (see its
// CONTACT_FLICK_CAPTURE_DX/RATIO/CONTACT_DRAG_SPACING, and its raw-DOM-listener web path below) —
// this camera fills the same "open letter" slot, so switching contacts while it's showing should
// feel identical.
const CONTACT_FLICK_CAPTURE_DX = 20;
const CONTACT_FLICK_CAPTURE_RATIO = 1.7;
const CONTACT_DRAG_SPACING = 70;

const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';
const FLIP_ICON = 'M4 4v5h5 M20 20v-5h-5 M4 9a8 8 0 0114-4.9L20 9 M20 15a8 8 0 01-14 4.9L4 15';
const GALLERY_ICON = 'M4 8h4l1.6-2.5h4.8L16 8h4v11H4z M12 11.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function pickSupportedVideoMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const type of ['video/mp4', 'video/webm;codecs=vp9', 'video/webm']) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

interface StoryCaptureScreenProps {
  onClose: () => void;
  onCaptured: (localUri: string, mediaType: StoryMediaType) => void;
  onPickedLongVideo: (localUri: string, durationMs: number) => void;
  /** Same horizontal flick-to-switch-contact gesture FoldingLetter offers while writing — this
   * camera fills the same letter-card slot, so it needs the same way to move between contacts
   * (including back out to Own Contact) without closing the camera first. */
  onContactDragStart?: () => void;
  onContactDragOffset?: (steps: number) => void;
}

/**
 * Web equivalent of the native camera screen — fills the same letter-card slot FoldingLetter/
 * ContactStoryStack otherwise occupy, rather than a separate full-screen takeover (see
 * ThrowHomeScreen's own "Status contact" handling). expo-camera's `CameraView.web` only implements
 * `takePicture`, with no video recording at all (confirmed directly in its source), so this
 * bypasses `CameraView` entirely and drives `getUserMedia` + `MediaRecorder` itself: a live
 * `<video>` preview, a hidden `<canvas>` for the photo snapshot, and a `MediaRecorder` on the same
 * stream for video. `MediaRecorder` support (and which codec) varies a lot across mobile
 * browsers — this checks for a working mime type up front and simply disables the hold-to-record
 * affordance (tap-for-photo still works) rather than recording into a codec that then can't
 * actually be played back; video is still fully postable either way via the gallery pick below,
 * which every browser handles reliably (including the trim flow for anything over 15s).
 */
export function StoryCaptureScreen({
  onClose,
  onCaptured,
  onPickedLongVideo,
  onContactDragStart,
  onContactDragOffset,
}: StoryCaptureScreenProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const videoMimeRef = useRef<string | null>(null);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRecordingRef = useRef(false);
  const wrapRef = useRef<View>(null);
  // Read inside the raw DOM listeners below without needing to re-attach them (and drop mid-
  // gesture state) whenever a prop identity changes — same pattern FoldingLetter's own web path uses.
  const latest = useRef({ onContactDragStart, onContactDragOffset });
  latest.current = { onContactDragStart, onContactDragOffset };
  const rawStartRef = useRef<{ x: number; y: number } | null>(null);
  const contactCapturedRef = useRef(false);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canRecordVideo = videoMimeRef.current !== null || pickSupportedVideoMimeType() !== null;

  const enterOpacity = useRef(new Animated.Value(0)).current;
  const enterScale = useRef(new Animated.Value(0.96)).current;
  const shutterScale = useRef(new Animated.Value(1)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const recordProgress = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(enterOpacity, { toValue: 1, duration: ENTER_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(enterScale, { toValue: 1, duration: ENTER_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirrors the enter animation in reverse — see the native sibling's own comment.
  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.parallel([
      Animated.timing(enterOpacity, { toValue: 0, duration: EXIT_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(enterScale, { toValue: 0.96, duration: EXIT_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => onClose());
  };

  useEffect(() => {
    videoMimeRef.current = pickSupportedVideoMimeType();
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: videoMimeRef.current !== null });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setError('Camera access is needed to post a story.');
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facingMode]);

  useEffect(
    () => () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
    },
    [],
  );

  // Same raw mouse/touch-listener approach FoldingLetter's own web path uses for its writing-phase
  // contact flick (see that file's own long comment on why): react-native-web's PanResponder
  // polyfill drops move events under a real drag, corrupting gestureState mid-gesture, so this
  // reads real pointer positions directly instead of trusting RN's own gesture tracking.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = wrapRef.current as any as HTMLElement | null;
    if (!node) return;
    const getPoint = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if ('touches' in e) {
        const t = e.touches[0];
        return t ? { x: t.clientX, y: t.clientY } : null;
      }
      return { x: e.clientX, y: e.clientY };
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      rawStartRef.current = getPoint(e);
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      const start = rawStartRef.current;
      if (!start) return;
      const p = getPoint(e);
      if (!p) return;
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      if (contactCapturedRef.current) {
        // Negated — same reversed writing-phase convention FoldingLetter's own contact flick
        // uses: right flicks back toward Own Contact/Status, left flicks forward.
        latest.current.onContactDragOffset?.(-dx / CONTACT_DRAG_SPACING);
        return;
      }
      if (Math.abs(dx) > CONTACT_FLICK_CAPTURE_DX && Math.abs(dx) > Math.abs(dy) * CONTACT_FLICK_CAPTURE_RATIO && latest.current.onContactDragOffset) {
        contactCapturedRef.current = true;
        latest.current.onContactDragStart?.();
        latest.current.onContactDragOffset(-dx / CONTACT_DRAG_SPACING);
      }
    };
    const onUp = () => {
      rawStartRef.current = null;
      contactCapturedRef.current = false;
    };
    node.addEventListener('mousedown', onDown);
    node.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      node.removeEventListener('mousedown', onDown);
      node.removeEventListener('touchstart', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;
    flashOpacity.setValue(1);
    Animated.timing(flashOpacity, { toValue: 0, duration: FLASH_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) onCaptured(URL.createObjectURL(blob), 'photo');
    }, 'image/jpeg');
  };

  const startRecording = () => {
    const stream = streamRef.current;
    const mimeType = videoMimeRef.current;
    if (!stream || !mimeType) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      if (maxDurationTimerRef.current) {
        clearTimeout(maxDurationTimerRef.current);
        maxDurationTimerRef.current = null;
      }
      const blob = new Blob(chunksRef.current, { type: mimeType });
      onCaptured(URL.createObjectURL(blob), 'video');
    };
    recorderRef.current = recorder;
    recorder.start();
    isRecordingRef.current = true;
    setRecording(true);
    recordProgress.setValue(0);
    Animated.timing(recordProgress, { toValue: 1, duration: MAX_VIDEO_MS, easing: Easing.linear, useNativeDriver: false }).start();
    maxDurationTimerRef.current = setTimeout(() => stopRecording(), MAX_VIDEO_MS);
  };

  const stopRecording = () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setRecording(false);
    recordProgress.stopAnimation();
    recordProgress.setValue(0);
    recorderRef.current?.stop();
  };

  const onShutterPressIn = () => {
    Animated.timing(shutterScale, { toValue: SHUTTER_PRESS_SCALE, duration: SHUTTER_SCALE_MS, useNativeDriver: true }).start();
    if (!canRecordVideo) return;
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      startRecording();
    }, HOLD_THRESHOLD_MS);
  };

  const onShutterPressOut = () => {
    Animated.timing(shutterScale, { toValue: 1, duration: SHUTTER_SCALE_MS, useNativeDriver: true }).start();
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      takePhoto();
      return;
    }
    stopRecording();
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.9 });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    const mediaType: StoryMediaType = asset.type === 'video' ? 'video' : 'photo';
    if (mediaType === 'video' && (asset.duration ?? 0) > MAX_VIDEO_MS) {
      onPickedLongVideo(asset.uri, asset.duration ?? 0);
      return;
    }
    onCaptured(asset.uri, mediaType);
  };

  if (error) {
    return (
      <View style={styles.permissionWrap}>
        <Text style={styles.permissionText}>{error}</Text>
        <Pressable onPress={onClose} style={styles.permissionClose} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={styles.permissionCloseText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Animated.View
      ref={wrapRef}
      style={[styles.screen, { opacity: enterOpacity, transform: [{ scale: enterScale }] }]}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} autoPlay playsInline muted style={webVideoStyle} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <Pressable onPress={handleClose} hitSlop={12} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close camera">
        <Icon path={CLOSE_ICON} size={22} color="#FFFFFF" strokeWidth={2.2} />
      </Pressable>

      {!recording && (
        <Pressable
          onPress={() => setFacingMode((f) => (f === 'user' ? 'environment' : 'user'))}
          hitSlop={12}
          style={styles.flipBtn}
          accessibilityRole="button"
          accessibilityLabel="Flip camera"
        >
          <Icon path={FLIP_ICON} size={22} color="#FFFFFF" strokeWidth={2} />
        </Pressable>
      )}

      <View style={styles.bottomRow}>
        <Pressable
          onPress={pickFromLibrary}
          disabled={recording}
          hitSlop={12}
          style={styles.galleryBtn}
          accessibilityRole="button"
          accessibilityLabel="Choose photo or video from library"
        >
          <Icon path={GALLERY_ICON} size={22} color="#FFFFFF" strokeWidth={1.8} />
        </Pressable>

        <Pressable
          onPressIn={onShutterPressIn}
          onPressOut={onShutterPressOut}
          accessibilityRole="button"
          accessibilityLabel={canRecordVideo ? 'Hold to record video, tap for a photo' : 'Take a photo'}
        >
          <View style={styles.shutterWrap}>
            {recording && (
              <Svg width={RING_SIZE} height={RING_SIZE} style={[styles.ringSvg]}>
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} stroke="rgba(255,255,255,.25)" strokeWidth={RING_THICKNESS} fill="none" />
                <AnimatedCircle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke="#FF3B30"
                  strokeWidth={RING_THICKNESS}
                  fill="none"
                  strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                  strokeDashoffset={recordProgress.interpolate({ inputRange: [0, 1], outputRange: [RING_CIRCUMFERENCE, 0] })}
                  strokeLinecap="round"
                  rotation="-90"
                  originX={RING_SIZE / 2}
                  originY={RING_SIZE / 2}
                />
              </Svg>
            )}
            <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
              <View style={[styles.shutterOuter, recording && styles.shutterOuterRecording]}>
                <View style={[styles.shutterInner, recording && styles.shutterInnerRecording]} />
              </View>
            </Animated.View>
          </View>
        </Pressable>

        <View style={styles.galleryBtn} />
      </View>

      {recording && <Text style={styles.recordingHint}>Recording… release to stop</Text>}

      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flashOpacity }]} />
    </Animated.View>
  );
}

const webVideoStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };

const styles = StyleSheet.create({
  // Rounded + clipped to match the same paper-card slot this fills (see ContactStoryStack's own
  // `card` style) — this used to be a genuine full-screen takeover, where square corners made
  // sense; embedded inline, it needs to read as part of the same card the letter/stories do.
  screen: { flex: 1, backgroundColor: '#000000', borderRadius: throwRadius.paper, overflow: 'hidden' },
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
  flipBtn: {
    position: 'absolute',
    top: 12,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomRow: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 36,
  },
  galleryBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  ringSvg: { position: 'absolute' },
  shutterOuter: {
    width: SHUTTER_SIZE,
    height: SHUTTER_SIZE,
    borderRadius: SHUTTER_SIZE / 2,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuterRecording: { borderColor: '#FF3B30' },
  shutterInner: { width: SHUTTER_SIZE - 14, height: SHUTTER_SIZE - 14, borderRadius: (SHUTTER_SIZE - 14) / 2, backgroundColor: '#FFFFFF' },
  shutterInnerRecording: { borderRadius: 8, backgroundColor: '#FF3B30' },
  recordingHint: { position: 'absolute', bottom: 140, alignSelf: 'center', color: '#FFFFFF', fontSize: 13 },
  flash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF' },
  permissionWrap: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: throwRadius.paper,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 20,
  },
  permissionText: { color: '#FFFFFF', fontSize: 15, textAlign: 'center' },
  permissionClose: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.15)' },
  permissionCloseText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
