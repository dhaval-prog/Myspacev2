import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { CameraType, CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import type { StatusCameraApi } from './useStatusCamera.web';

const MAX_VIDEO_SECONDS = 15;

/**
 * Native half of the status camera — expo-camera's own imperative API (takePictureAsync/
 * recordAsync/stopRecording) does the real work; this just normalizes it to the same shape
 * useStatusCamera.web exposes (facing as 'user'/'environment' rather than 'front'/'back', a
 * single `denied` flag, warm/cool instead of the permission hooks' own request calls) so
 * MyStatusPanel's own UI/orchestration code never needs to know which platform it's on.
 */
export function useStatusCamera(): StatusCameraApi {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [mode, setMode] = useState<'picture' | 'video'>('picture');
  const [warmed, setWarmed] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const recordResolveRef = useRef<((r: { uri: string; durationMs: number } | null) => void) | null>(null);
  const recordStartRef = useRef(0);

  const warm = useCallback(() => {
    setWarmed(true);
    if (!cameraPermission?.granted) requestCameraPermission();
    if (!micPermission?.granted) requestMicPermission();
  }, [cameraPermission, micPermission, requestCameraPermission, requestMicPermission]);

  const cool = useCallback(() => setWarmed(false), []);

  const flip = () => setFacing((f) => (f === 'front' ? 'back' : 'front'));

  const takePhoto = useCallback(async (): Promise<string | null> => {
    const pic = await cameraRef.current?.takePictureAsync();
    return pic?.uri ?? null;
  }, []);

  const startRecording = useCallback(() => {
    setMode('video');
    recordStartRef.current = performance.now();
    cameraRef.current
      ?.recordAsync({ maxDuration: MAX_VIDEO_SECONDS })
      .then((result) => {
        const durationMs = performance.now() - recordStartRef.current;
        recordResolveRef.current?.(result?.uri ? { uri: result.uri, durationMs } : null);
        recordResolveRef.current = null;
      })
      .finally(() => setMode('picture'));
  }, []);

  const stopRecording = useCallback((): Promise<{ uri: string; durationMs: number } | null> => {
    return new Promise((resolve) => {
      recordResolveRef.current = resolve;
      cameraRef.current?.stopRecording();
    });
  }, []);

  const granted = !!cameraPermission?.granted;
  const denied = !!cameraPermission && !cameraPermission.granted && !cameraPermission.canAskAgain;

  const renderPreview = () =>
    warmed && granted ? (
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} mode={mode} videoQuality="720p" mirror={facing === 'front'} />
    ) : null;

  return {
    renderPreview,
    facingIsUser: facing === 'front',
    flip,
    denied,
    live: warmed && granted,
    warm,
    cool,
    takePhoto,
    startRecording,
    stopRecording,
    canRecordVideo: true,
  };
}
