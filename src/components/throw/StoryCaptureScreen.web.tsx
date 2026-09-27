import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '../Icon';
import type { StoryMediaType } from '../../types/story';

const HOLD_THRESHOLD_MS = 220;
const MAX_VIDEO_MS = 15000;

const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';
const FLIP_ICON = 'M4 4v5h5 M20 20v-5h-5 M4 9a8 8 0 0114-4.9L20 9 M20 15a8 8 0 01-14 4.9L4 15';
const GALLERY_ICON = 'M4 8h4l1.6-2.5h4.8L16 8h4v11H4z M12 11.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z';

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
}

/**
 * Web equivalent of the native camera screen — expo-camera's `CameraView.web` only implements
 * `takePicture`, with no video recording at all (confirmed directly in its source), so this
 * bypasses `CameraView` entirely and drives `getUserMedia` + `MediaRecorder` itself: a live
 * `<video>` preview, a hidden `<canvas>` for the photo snapshot, and a `MediaRecorder` on the same
 * stream for video. `MediaRecorder` support (and which codec) varies a lot across mobile
 * browsers — this checks for a working mime type up front and simply disables the hold-to-record
 * affordance (tap-for-photo still works) rather than recording into a codec that then can't
 * actually be played back; video is still fully postable either way via the gallery pick below,
 * which every browser handles reliably (including the trim flow for anything over 15s).
 */
export function StoryCaptureScreen({ onClose, onCaptured, onPickedLongVideo }: StoryCaptureScreenProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const videoMimeRef = useRef<string | null>(null);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRecordingRef = useRef(false);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canRecordVideo = videoMimeRef.current !== null || pickSupportedVideoMimeType() !== null;

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

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;
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
    maxDurationTimerRef.current = setTimeout(() => stopRecording(), MAX_VIDEO_MS);
  };

  const stopRecording = () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setRecording(false);
    recorderRef.current?.stop();
  };

  const onShutterPressIn = () => {
    if (!canRecordVideo) return;
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
    <View style={styles.screen}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} autoPlay playsInline muted style={webVideoStyle} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close camera">
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

const webVideoStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };

const SHUTTER_SIZE = 74;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  closeBtn: {
    position: 'absolute',
    top: 24,
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
    top: 24,
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
    bottom: 48,
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
  permissionWrap: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 },
  permissionText: { color: '#FFFFFF', fontSize: 15, textAlign: 'center' },
  permissionClose: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.15)' },
  permissionCloseText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
