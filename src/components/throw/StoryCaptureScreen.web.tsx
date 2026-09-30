import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '../Icon';
import { throwRadius } from '../../theme/throwTokens';
import { noSelect } from '../../theme/webStyles';
import { formatClockMs } from '../../utils/formatClock';
import type { StoryMediaType } from '../../types/story';

const MAX_VIDEO_MS = 15000;

// Purely cosmetic polish on top of the existing capture flow — see the native sibling's own
// comment on the same constants (no change to tap/hold thresholds, recording behavior, or
// gestures above/below).
const ENTER_MS = 220;
const SHUTTER_PRESS_SCALE = 0.88;
const SHUTTER_SCALE_MS = 110;
const FLASH_MS = 160;
const SHUTTER_SIZE = 74;
// Closing now flies the whole camera up and shrinks it into the status contact's own avatar
// ring — see the native sibling's own comment on these same constants.
const CLOSE_FLIGHT_MS = 480;
const CLOSE_MIN_SCALE = 0.12;
const DEFAULT_CLOSE_FLIGHT_DISTANCE = 260;
// A thin ring drawn just outside the shutter button, filling clockwise over the 15s cap while
// recording — same as the native sibling's own ring (see its comment).
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
// A plain circular "flip camera" glyph (two arcs + arrowheads forming a full loop) — replaces the
// previous single-squiggle version per explicit request, matching a reference screenshot.
const FLIP_ICON = 'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0020.49 15';
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
  onContactDragEnd?: () => void;
  /** The status contact's own avatar, in absolute screen coordinates — see the native sibling's
   * own comment. */
  flightTargetY?: number;
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
  onContactDragEnd,
  flightTargetY,
}: StoryCaptureScreenProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const videoMimeRef = useRef<string | null>(null);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRecordingRef = useRef(false);
  const wrapRef = useRef<View>(null);
  // Read inside the raw DOM listeners below without needing to re-attach them (and drop mid-
  // gesture state) whenever a prop identity changes — same pattern FoldingLetter's own web path uses.
  const latest = useRef({ onContactDragStart, onContactDragOffset, onContactDragEnd });
  latest.current = { onContactDragStart, onContactDragOffset, onContactDragEnd };
  const rawStartRef = useRef<{ x: number; y: number } | null>(null);
  const contactCapturedRef = useRef(false);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [recording, setRecording] = useState(false);
  const [captureMode, setCaptureMode] = useState<'photo' | 'video'>('photo');
  // The recording countdown's own guide — "0:07 / 0:15" — ticked on a plain interval rather than
  // read off recordProgress (an Animated.Value, not meant to be sampled synchronously from JS) so
  // the two stay visually in lockstep without needing a listener on the animation itself.
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canRecordVideo = videoMimeRef.current !== null || pickSupportedVideoMimeType() !== null;

  const enterOpacity = useRef(new Animated.Value(0)).current;
  const enterScale = useRef(new Animated.Value(0.96)).current;
  const closeFlightY = useRef(new Animated.Value(0)).current;
  const shutterScale = useRef(new Animated.Value(1)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const recordProgress = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);
  // Read inside handleClose without needing to rebuild it on every relayout.
  const flightDistanceRef = useRef(DEFAULT_CLOSE_FLIGHT_DISTANCE);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(enterOpacity, { toValue: 1, duration: ENTER_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(enterScale, { toValue: 1, duration: ENTER_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLayout = () => {
    if (flightTargetY == null) return;
    requestAnimationFrame(() => {
      wrapRef.current?.measureInWindow((_x, y, _width, height) => {
        const ownCenterY = y + height / 2;
        flightDistanceRef.current = Math.max(140, ownCenterY - flightTargetY);
      });
    });
  };

  // Flies the whole camera up and shrinks it into the status contact's own avatar — see the
  // native sibling's own comment.
  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.parallel([
      Animated.timing(enterOpacity, { toValue: 0, duration: CLOSE_FLIGHT_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(enterScale, { toValue: CLOSE_MIN_SCALE, duration: CLOSE_FLIGHT_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(closeFlightY, { toValue: -flightDistanceRef.current, duration: CLOSE_FLIGHT_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
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
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Setting `srcObject` alone leaves Mobile Safari showing its own big centered "tap to
          // play" overlay instead of actually playing — the `autoplay` HTML attribute isn't
          // reliably honored for a stream assigned this way after mount. Calling `.play()`
          // directly starts it for real; the promise it returns rejects harmlessly if the stream
          // hasn't attached yet (a rapid facingMode flip beating the previous stream's teardown),
          // which is already covered by this same effect re-running.
          videoRef.current.play().catch(() => {});
        }
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
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
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
      const wasContactDrag = contactCapturedRef.current;
      contactCapturedRef.current = false;
      if (wasContactDrag) latest.current.onContactDragEnd?.();
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
    const t0 = Date.now();
    setElapsedMs(0);
    elapsedTimerRef.current = setInterval(() => setElapsedMs(Math.min(MAX_VIDEO_MS, Date.now() - t0)), 200);
  };

  const stopRecording = () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setRecording(false);
    recordProgress.stopAnimation();
    recordProgress.setValue(0);
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    setElapsedMs(0);
    recorderRef.current?.stop();
  };

  // One shutter button whose action depends on the VIDEO/PHOTO toggle beside it — take a photo
  // immediately in photo mode, or start/stop a recording in video mode (a plain tap toggle: press
  // once to start, up to MAX_VIDEO_MS which auto-stops it, press the same button again to stop
  // early — not a hold-to-record gesture, which depended on the browser reliably firing onPressIn
  // *and* a later onPressOut for the same continuous touch, exactly the kind of held touch Mobile
  // Safari's own long-press-to-select-text callout also keys off; see noSelect below either way).
  const onShutterPress = () => {
    Animated.sequence([
      Animated.timing(shutterScale, { toValue: SHUTTER_PRESS_SCALE, duration: SHUTTER_SCALE_MS, useNativeDriver: true }),
      Animated.timing(shutterScale, { toValue: 1, duration: SHUTTER_SCALE_MS, useNativeDriver: true }),
    ]).start();
    if (captureMode === 'photo') {
      takePhoto();
      return;
    }
    if (recording) stopRecording();
    else startRecording();
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.9 });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    const mediaType: StoryMediaType = asset.type === 'video' ? 'video' : 'photo';
    // expo-image-picker documents `duration` as milliseconds (and native platforms honor that),
    // but this file only ever runs on web, where its shim hands back the raw
    // HTMLVideoElement.duration instead — seconds, not ms — so this always needs converting.
    const durationMs = (asset.duration ?? 0) * 1000;
    if (mediaType === 'video' && durationMs > MAX_VIDEO_MS) {
      onPickedLongVideo(asset.uri, durationMs);
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
      onLayout={onLayout}
      style={[styles.screen, noSelect, { opacity: enterOpacity, transform: [{ translateY: closeFlightY }, { scale: enterScale }] }]}
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
          <Icon path={FLIP_ICON} size={20} color="#FFFFFF" strokeWidth={2} />
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

        <View style={styles.shutterColumn}>
          <Pressable onPress={onShutterPress} accessibilityRole="button" accessibilityLabel={captureMode === 'photo' ? 'Take a photo' : recording ? 'Stop recording' : 'Record a video'}>
            <Animated.View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center', transform: [{ scale: shutterScale }] }}>
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
              <View style={[styles.shutterOuter, captureMode === 'video' && styles.shutterOuterVideo]}>
                <View style={[styles.shutterInner, captureMode === 'video' && styles.shutterInnerVideo, recording && styles.shutterInnerRecording]} />
              </View>
            </Animated.View>
          </Pressable>

          {/* The VIDEO/PHOTO segmented toggle — replaces the previous separate record button
              beside the shutter (per explicit request, matching a reference screenshot): one
              shutter button now does either job, its own color/shape reflecting whichever mode is
              selected here instead of two visually distinct buttons side by side. Locked out
              entirely while actively recording (can't switch modes mid-recording), and "VIDEO"
              itself stays dimmed/non-interactive wherever this browser can't record video at all
              (see canRecordVideo) — tap-for-photo still always works either way. */}
          <View style={styles.modeToggle}>
            <Pressable onPress={() => setCaptureMode('video')} disabled={recording || !canRecordVideo} hitSlop={6}>
              <Text style={[styles.modeText, captureMode === 'video' && styles.modeTextActive, !canRecordVideo && styles.modeTextDisabled]}>VIDEO</Text>
            </Pressable>
            <Pressable onPress={() => setCaptureMode('photo')} disabled={recording} hitSlop={6}>
              <Text style={[styles.modeText, captureMode === 'photo' && styles.modeTextActive]}>PHOTO</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.galleryBtn} />
      </View>

      {recording && (
        <Text style={styles.recordingHint}>
          {formatClockMs(elapsedMs)} / {formatClockMs(MAX_VIDEO_MS)} · tap to stop
        </Text>
      )}

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
    // Plain, same as closeBtn — no accent border, per explicit request matching a reference
    // screenshot (a colored ring here read as an unrelated "active/selected" signal).
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
  shutterColumn: { alignItems: 'center', gap: 10 },
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
  shutterInner: { width: SHUTTER_SIZE - 14, height: SHUTTER_SIZE - 14, borderRadius: (SHUTTER_SIZE - 14) / 2, backgroundColor: '#FFFFFF' },
  // Video mode's own idle look — a solid red disc instead of white, the same shutter button just
  // recolored rather than a visually distinct second button (see onShutterPress's own comment).
  shutterOuterVideo: { borderColor: '#FF3B30' },
  shutterInnerVideo: { backgroundColor: '#FF3B30' },
  // While actually recording, the inner disc becomes a rounded "stop" square — same affordance
  // the previous dedicated record button gave, just carried over onto this one button now.
  shutterInnerRecording: { width: SHUTTER_SIZE - 30, height: SHUTTER_SIZE - 30, borderRadius: 6 },
  modeToggle: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  modeText: { fontFamily: 'Figtree_700Bold', fontSize: 12, letterSpacing: 1, color: 'rgba(255,255,255,.55)' },
  modeTextActive: { color: '#FFD60A' },
  modeTextDisabled: { opacity: 0.4 },
  recordingHint: {
    position: 'absolute',
    bottom: 150,
    alignSelf: 'center',
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Figtree_700Bold',
    backgroundColor: 'rgba(0,0,0,.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
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
