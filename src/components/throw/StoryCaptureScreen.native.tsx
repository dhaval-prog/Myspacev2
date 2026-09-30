import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { CameraType, CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Icon } from '../Icon';
import { throwRadius } from '../../theme/throwTokens';
import { formatClockMs } from '../../utils/formatClock';
import type { StoryMediaType } from '../../types/story';

const MAX_VIDEO_SECONDS = 15;

// Purely cosmetic polish on top of the existing capture flow — no change to the tap/hold
// thresholds, recording behavior, or gestures above/below. A soft fade+scale-in on mount (rather
// than the camera just appearing instantly) reads as it being smoothly summoned into the letter
// card, not popped into place; the shutter's own press-scale gives the button real weight; the
// brief white flash on a photo capture mimics an actual shutter flash.
const ENTER_MS = 220;
const SHUTTER_PRESS_SCALE = 0.88;
const SHUTTER_SCALE_MS = 110;
const FLASH_MS = 160;
const SHUTTER_SIZE = 74;
// Closing now flies the whole camera up and shrinks it into the status contact's own avatar
// ring — the same flight-and-shrink StoryPreviewScreen's "Add to status" already uses for a
// confirmed photo (identical constants/easing, so both read as the same visual language), rather
// than the old in-place fade — per explicit request with its own reference screenshot.
const CLOSE_FLIGHT_MS = 480;
const CLOSE_MIN_SCALE = 0.12;
const DEFAULT_CLOSE_FLIGHT_DISTANCE = 260;
// A thin ring drawn just outside the shutter button, filling clockwise over the 15s cap while
// recording — the same "how much longer can this run" cue Instagram/Snapchat's own record buttons
// give.
const RING_SIZE = SHUTTER_SIZE + 16;
const RING_THICKNESS = 3;
const RING_RADIUS = (RING_SIZE - RING_THICKNESS) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Persisted at module scope (not component state) so it survives this component unmounting and
// remounting — which happens every time the user swipes away from Status and back (see
// ThrowHomeScreen's isCaptureMode) — and only ever auto-asks once per app session. Without this,
// swiping in and out repeatedly while permission is still undetermined re-shows the system
// dialog every single time; the permission-denied screen below offers an explicit manual retry
// instead, which is a user-initiated ask and fine to re-prompt for.
let hasRequestedCameraPermission = false;
let hasRequestedMicPermission = false;

// Same thresholds/spacing FoldingLetter's own writing-phase contact flick uses (see its
// CONTACT_FLICK_CAPTURE_DX/RATIO/CONTACT_DRAG_SPACING) — this camera fills the same "open letter"
// slot, so switching contacts while it's showing should feel identical.
const CONTACT_FLICK_CAPTURE_DX = 20;
const CONTACT_FLICK_CAPTURE_RATIO = 1.7;
const CONTACT_DRAG_SPACING = 70;

const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';
// A plain circular "flip camera" glyph (two arcs + arrowheads forming a full loop) — replaces the
// previous single-squiggle version per explicit request, matching a reference screenshot (see the
// web sibling's own copy of this constant).
const FLIP_ICON = 'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0020.49 15';
const GALLERY_ICON = 'M4 8h4l1.6-2.5h4.8L16 8h4v11H4z M12 11.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface StoryCaptureScreenProps {
  onClose: () => void;
  /** A photo, or a video already within the 15s cap (recorded live, so it can never be longer) —
   * ready to post as-is. A picked-from-library video over 15s instead goes through
   * onPickedLongVideo below (needs trimming first). */
  onCaptured: (localUri: string, mediaType: StoryMediaType) => void;
  /** A library-picked video whose duration ran past MAX_VIDEO_SECONDS — the caller shows the trim
   * screen before this can be posted. */
  onPickedLongVideo: (localUri: string, durationMs: number) => void;
  /** Same horizontal flick-to-switch-contact gesture FoldingLetter offers while writing — this
   * camera fills the same letter-card slot, so it needs the same way to move between contacts
   * (including back out to Own Contact) without closing the camera first. */
  onContactDragStart?: () => void;
  onContactDragOffset?: (steps: number) => void;
  onContactDragEnd?: () => void;
  /** The status contact's own avatar, in absolute screen coordinates (see ThrowHomeScreen's own
   * storyFlightTargetY) — closing the camera flies it up and shrinks it toward this exact point,
   * the same destination StoryPreviewScreen's "Add to status" flies a confirmed photo to, per
   * explicit request. Falls back to a fixed distance if omitted. */
  flightTargetY?: number;
}

/** Camera for posting a Throw story, filling the same letter-card slot FoldingLetter/
 * ContactStoryStack otherwise occupy (see ThrowHomeScreen's own "Status contact" handling) rather
 * than a separate full-screen takeover — a VIDEO/PHOTO toggle picks which mode the single shutter
 * button acts as, tapping it either takes a photo or starts/stops up to 15s of video recording
 * (auto-stops at the cap; see onShutterPress — a plain toggle rather than the earlier hold-to-
 * record/release-to-stop gesture, which depended on the browser reliably tracking one continuous
 * held touch and lost that race with Mobile Safari's own long-press-to-select-text callout on a
 * real device), or tap the gallery icon (bottom-left) to pick existing media instead. Native only:
 * expo-camera's web implementation has no video-recording support at all (see the .web sibling of
 * this file), so this native path is the live-recording one; both share the same
 * onCaptured/onPickedLongVideo contract. */
export function StoryCaptureScreen({
  onClose,
  onCaptured,
  onPickedLongVideo,
  onContactDragStart,
  onContactDragOffset,
  onContactDragEnd,
  flightTargetY,
}: StoryCaptureScreenProps) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [mode, setMode] = useState<'picture' | 'video'>('picture');
  const [recording, setRecording] = useState(false);
  // The recording countdown's own guide — "0:07 / 0:15" — see the web sibling's own copy of this
  // same pattern (a plain interval, not read off recordProgress itself).
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const isRecordingRef = useRef(false);

  const enterOpacity = useRef(new Animated.Value(0)).current;
  const enterScale = useRef(new Animated.Value(0.96)).current;
  const closeFlightY = useRef(new Animated.Value(0)).current;
  const shutterScale = useRef(new Animated.Value(1)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const recordProgress = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);
  const wrapRef = useRef<View>(null);
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

  // Flies the whole camera up and shrinks it into the status contact's own avatar — the same
  // flight-and-shrink StoryPreviewScreen's "Add to status" already uses for a confirmed photo
  // (see CLOSE_FLIGHT_MS/CLOSE_MIN_SCALE's own comment) — and only calls the real onClose once
  // that's played out, so the parent doesn't unmount this mid-flight. Guarded against a double
  // tap firing it twice while the exit is already in flight.
  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.parallel([
      Animated.timing(enterOpacity, { toValue: 0, duration: CLOSE_FLIGHT_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(enterScale, { toValue: CLOSE_MIN_SCALE, duration: CLOSE_FLIGHT_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(closeFlightY, { toValue: -flightDistanceRef.current, duration: CLOSE_FLIGHT_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => onClose());
  };

  // Read inside the PanResponder's callbacks without needing to rebuild it (and drop mid-gesture
  // capture state) whenever a prop identity changes.
  const latest = useRef({ onContactDragStart, onContactDragOffset, onContactDragEnd });
  latest.current = { onContactDragStart, onContactDragOffset, onContactDragEnd };
  const contactCapturedRef = useRef(false);

  const contactPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: (_, g) => {
          if (!latest.current.onContactDragOffset) return false;
          return Math.abs(g.dx) > CONTACT_FLICK_CAPTURE_DX && Math.abs(g.dx) > Math.abs(g.dy) * CONTACT_FLICK_CAPTURE_RATIO;
        },
        onPanResponderGrant: () => {
          contactCapturedRef.current = true;
          latest.current.onContactDragStart?.();
        },
        onPanResponderMove: (_, g) => {
          // Negated — same reversed writing-phase convention FoldingLetter's own contact flick
          // uses now: right flicks back toward Own Contact/Status, left flicks forward.
          latest.current.onContactDragOffset?.(-g.dx / CONTACT_DRAG_SPACING);
        },
        onPanResponderRelease: () => {
          contactCapturedRef.current = false;
          latest.current.onContactDragEnd?.();
        },
        onPanResponderTerminate: () => {
          contactCapturedRef.current = false;
          latest.current.onContactDragEnd?.();
        },
      }),
    [],
  );

  useEffect(() => {
    if (!cameraPermission?.granted && !hasRequestedCameraPermission) {
      hasRequestedCameraPermission = true;
      requestCameraPermission();
    }
    if (!micPermission?.granted && !hasRequestedMicPermission) {
      hasRequestedMicPermission = true;
      requestMicPermission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    },
    [],
  );

  const takePhoto = async () => {
    flashOpacity.setValue(1);
    Animated.timing(flashOpacity, { toValue: 0, duration: FLASH_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const pic = await cameraRef.current?.takePictureAsync();
    if (pic?.uri) onCaptured(pic.uri, 'photo');
  };

  const startRecording = async () => {
    isRecordingRef.current = true;
    setRecording(true);
    recordProgress.setValue(0);
    Animated.timing(recordProgress, { toValue: 1, duration: MAX_VIDEO_SECONDS * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    const t0 = Date.now();
    setElapsedMs(0);
    elapsedTimerRef.current = setInterval(() => setElapsedMs(Math.min(MAX_VIDEO_SECONDS * 1000, Date.now() - t0)), 200);
    try {
      // Resolves once stopRecording() is called (see onShutterPress) or the 15s cap is hit —
      // either way the result is already within the cap, so it never needs the trim screen.
      const result = await cameraRef.current?.recordAsync({ maxDuration: MAX_VIDEO_SECONDS });
      if (result?.uri) onCaptured(result.uri, 'video');
    } finally {
      isRecordingRef.current = false;
      setRecording(false);
      recordProgress.stopAnimation();
      recordProgress.setValue(0);
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
      setElapsedMs(0);
    }
  };

  // One shutter button whose action depends on the VIDEO/PHOTO toggle beside it — take a photo
  // immediately in picture mode, or start/stop a recording in video mode (a plain tap toggle,
  // replacing the previous hold-to-record/release-to-stop gesture — see this file's own doc
  // comment on why). `mode` itself (also CameraView's own required prop) is set directly by that
  // toggle now, not implicitly by starting/stopping a recording.
  const onShutterPress = () => {
    Animated.sequence([
      Animated.timing(shutterScale, { toValue: SHUTTER_PRESS_SCALE, duration: SHUTTER_SCALE_MS, useNativeDriver: true }),
      Animated.timing(shutterScale, { toValue: 1, duration: SHUTTER_SCALE_MS, useNativeDriver: true }),
    ]).start();
    if (mode === 'picture') {
      takePhoto();
      return;
    }
    if (isRecordingRef.current) cameraRef.current?.stopRecording();
    else startRecording();
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.9 });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    const mediaType: StoryMediaType = asset.type === 'video' ? 'video' : 'photo';
    if (mediaType === 'video' && (asset.duration ?? 0) > MAX_VIDEO_SECONDS * 1000) {
      onPickedLongVideo(asset.uri, asset.duration ?? 0);
      return;
    }
    onCaptured(asset.uri, mediaType);
  };

  if (!cameraPermission?.granted) {
    return (
      <View style={styles.permissionWrap}>
        <Text style={styles.permissionText}>Camera access is needed to post a story.</Text>
        {/* A manual, user-initiated ask — unlike the auto-request above, it's fine for this one to
            show the system dialog again every time it's tapped. */}
        <Pressable
          onPress={() => requestCameraPermission()}
          style={styles.permissionGrant}
          accessibilityRole="button"
          accessibilityLabel="Grant camera access"
        >
          <Text style={styles.permissionGrantText}>Grant Access</Text>
        </Pressable>
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
      style={[styles.screen, { opacity: enterOpacity, transform: [{ translateY: closeFlightY }, { scale: enterScale }] }]}
      {...contactPanResponder.panHandlers}
    >
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} mode={mode} videoQuality="720p" />

      <Pressable onPress={handleClose} hitSlop={12} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close camera">
        <Icon path={CLOSE_ICON} size={22} color="#FFFFFF" strokeWidth={2.2} />
      </Pressable>

      {!recording && (
        <Pressable
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
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
          <Pressable onPress={onShutterPress} accessibilityRole="button" accessibilityLabel={mode === 'picture' ? 'Take a photo' : recording ? 'Stop recording' : 'Record a video'}>
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
              <View style={[styles.shutterOuter, mode === 'video' && styles.shutterOuterVideo]}>
                <View style={[styles.shutterInner, mode === 'video' && styles.shutterInnerVideo, recording && styles.shutterInnerRecording]} />
              </View>
            </Animated.View>
          </Pressable>

          {/* The VIDEO/PHOTO segmented toggle — replaces the previous separate record button
              beside the shutter (per explicit request, matching a reference screenshot): one
              shutter button now does either job, its own color/shape reflecting whichever mode is
              selected here instead of two visually distinct buttons side by side. Locked out
              entirely while actively recording (can't switch modes mid-recording). */}
          <View style={styles.modeToggle}>
            <Pressable onPress={() => setMode('video')} disabled={recording} hitSlop={6}>
              <Text style={[styles.modeText, mode === 'video' && styles.modeTextActive]}>VIDEO</Text>
            </Pressable>
            <Pressable onPress={() => setMode('picture')} disabled={recording} hitSlop={6}>
              <Text style={[styles.modeText, mode === 'picture' && styles.modeTextActive]}>PHOTO</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.galleryBtn} />
      </View>

      {recording && (
        <Text style={styles.recordingHint}>
          {formatClockMs(elapsedMs)} / {formatClockMs(MAX_VIDEO_SECONDS * 1000)} · tap to stop
        </Text>
      )}

      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flashOpacity }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Rounded + clipped to match the same paper-card slot this fills (see ContactStoryStack's own
  // `card` style) — this used to be a genuine full-screen takeover, where square corners made
  // sense; embedded inline, it needs to read as part of the same card the letter/stories do.
  screen: { flex: 1, backgroundColor: '#000000', borderRadius: throwRadius.paper, overflow: 'hidden' },
  closeBtn: {
    position: 'absolute',
    // No longer sitting under a device status bar (that's the outer screen's job) — a small fixed
    // inset now that this is one card's own corner, not the top of the whole device.
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
  permissionGrant: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, backgroundColor: '#FFFFFF' },
  permissionGrantText: { color: '#000000', fontSize: 14, fontWeight: '600' },
  permissionClose: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.15)' },
  permissionCloseText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
