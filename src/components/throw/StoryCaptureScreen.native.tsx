import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraType, CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Icon } from '../Icon';
import { throwRadius } from '../../theme/throwTokens';
import type { StoryMediaType } from '../../types/story';

// Instagram/WhatsApp's own convention: a quick tap takes a photo, holding the shutter records
// video — this is the delay before a still-held press commits to "recording" rather than "about
// to be a tap". Matched to FOLD_CAPTURE_DY's own role elsewhere in Throw: distinguishing two
// gestures sharing one control by how long/far it's gone, not a separate button each.
const HOLD_THRESHOLD_MS = 220;
const MAX_VIDEO_SECONDS = 15;

// Same thresholds/spacing FoldingLetter's own writing-phase contact flick uses (see its
// CONTACT_FLICK_CAPTURE_DX/RATIO/CONTACT_DRAG_SPACING) — this camera fills the same "open letter"
// slot, so switching contacts while it's showing should feel identical.
const CONTACT_FLICK_CAPTURE_DX = 20;
const CONTACT_FLICK_CAPTURE_RATIO = 1.7;
const CONTACT_DRAG_SPACING = 70;

const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';
const FLIP_ICON = 'M4 4v5h5 M20 20v-5h-5 M4 9a8 8 0 0114-4.9L20 9 M20 15a8 8 0 01-14 4.9L4 15';
const GALLERY_ICON = 'M4 8h4l1.6-2.5h4.8L16 8h4v11H4z M12 11.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z';

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
}: StoryCaptureScreenProps) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [mode, setMode] = useState<'picture' | 'video'>('picture');
  const [recording, setRecording] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRecordingRef = useRef(false);

  // Read inside the PanResponder's callbacks without needing to rebuild it (and drop mid-gesture
  // capture state) whenever a prop identity changes.
  const latest = useRef({ onContactDragStart, onContactDragOffset });
  latest.current = { onContactDragStart, onContactDragOffset };
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
        },
        onPanResponderTerminate: () => {
          contactCapturedRef.current = false;
        },
      }),
    [],
  );

  useEffect(() => {
    if (!cameraPermission?.granted) requestCameraPermission();
    if (!micPermission?.granted) requestMicPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
  }, []);

  const takePhoto = async () => {
    const pic = await cameraRef.current?.takePictureAsync();
    if (pic?.uri) onCaptured(pic.uri, 'photo');
  };

  const startRecording = async () => {
    setMode('video');
    isRecordingRef.current = true;
    setRecording(true);
    try {
      // Resolves once stopRecording() is called (see onShutterPressOut) or the 15s cap is hit —
      // either way the result is already within the cap, so it never needs the trim screen.
      const result = await cameraRef.current?.recordAsync({ maxDuration: MAX_VIDEO_SECONDS });
      if (result?.uri) onCaptured(result.uri, 'video');
    } finally {
      isRecordingRef.current = false;
      setRecording(false);
      setMode('picture');
    }
  };

  const onShutterPressIn = () => {
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      startRecording();
    }, HOLD_THRESHOLD_MS);
  };

  const onShutterPressOut = () => {
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
        <Pressable onPress={onClose} style={styles.permissionClose} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={styles.permissionCloseText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen} {...contactPanResponder.panHandlers}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} mode={mode} videoQuality="720p" />

      <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close camera">
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
          <View style={[styles.shutterOuter, recording && styles.shutterOuterRecording]}>
            <View style={[styles.shutterInner, recording && styles.shutterInnerRecording]} />
          </View>
        </Pressable>

        <View style={styles.galleryBtn} />
      </View>

      {recording && <Text style={styles.recordingHint}>Recording… release to stop</Text>}
    </View>
  );
}

const SHUTTER_SIZE = 74;

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
