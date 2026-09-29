import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { CameraType, CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Icon } from '../Icon';
import { throwColor, throwRadius } from '../../theme/throwTokens';
import type { StoryMediaType } from '../../types/story';

// Instagram/WhatsApp's own convention: a quick tap takes a photo, holding the shutter records
// video — this is the delay before a still-held press commits to "recording" rather than "about
// to be a tap". Matched to FOLD_CAPTURE_DY's own role elsewhere in Throw: distinguishing two
// gestures sharing one control by how long/far it's gone, not a separate button each.
const HOLD_THRESHOLD_MS = 220;
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
// A thin ring drawn just outside the shutter, filling clockwise over the 15s cap while recording
// — the same "how much longer can I hold this" cue Instagram/Snapchat's own record buttons give.
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
const FLIP_ICON = 'M4 4v5h5 M20 20v-5h-5 M4 9a8 8 0 0114-4.9L20 9 M20 15a8 8 0 01-14 4.9L4 15';
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
 * than a separate full-screen takeover — tap the shutter for a photo, hold it to record up to 15s
 * of video (auto-stops at the cap), or tap the gallery icon (bottom-left) to pick existing media
 * instead. Native only: expo-camera's web implementation has no video-recording support at all
 * (see the .web sibling of this file), so this native path is the live-recording one; both share
 * the same onCaptured/onPickedLongVideo contract. */
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
  const cameraRef = useRef<CameraView>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  useEffect(() => () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
  }, []);

  const takePhoto = async () => {
    flashOpacity.setValue(1);
    Animated.timing(flashOpacity, { toValue: 0, duration: FLASH_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const pic = await cameraRef.current?.takePictureAsync();
    if (pic?.uri) onCaptured(pic.uri, 'photo');
  };

  const startRecording = async () => {
    setMode('video');
    isRecordingRef.current = true;
    setRecording(true);
    recordProgress.setValue(0);
    Animated.timing(recordProgress, { toValue: 1, duration: MAX_VIDEO_SECONDS * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    try {
      // Resolves once stopRecording() is called (see onShutterPressOut) or the 15s cap is hit —
      // either way the result is already within the cap, so it never needs the trim screen.
      const result = await cameraRef.current?.recordAsync({ maxDuration: MAX_VIDEO_SECONDS });
      if (result?.uri) onCaptured(result.uri, 'video');
    } finally {
      isRecordingRef.current = false;
      setRecording(false);
      setMode('picture');
      recordProgress.stopAnimation();
      recordProgress.setValue(0);
    }
  };

  const onShutterPressIn = () => {
    Animated.timing(shutterScale, { toValue: SHUTTER_PRESS_SCALE, duration: SHUTTER_SCALE_MS, useNativeDriver: true }).start();
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
    if (isRecordingRef.current) cameraRef.current?.stopRecording();
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
          accessibilityLabel="Hold to record video, tap for a photo"
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
    backgroundColor: 'rgba(0,0,0,.4)',
    // Same blue accent Throw's active/selected chrome already uses elsewhere (the carousel's own
    // pulse ring, the selected map pin) — per explicit request with its own reference screenshot.
    borderWidth: 1.5,
    borderColor: throwColor.activeBlue,
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
  permissionGrant: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, backgroundColor: '#FFFFFF' },
  permissionGrantText: { color: '#000000', fontSize: 14, fontWeight: '600' },
  permissionClose: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.15)' },
  permissionCloseText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
