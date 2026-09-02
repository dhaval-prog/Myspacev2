import React from 'react';
import { StyleSheet, View } from 'react-native';

interface VideoTileProps {
  stream: unknown;
  /** Web-only concern (an HTML <video> element's own audio playback) — native's RTCView never plays audio itself, so this is accepted but unused here. */
  muted?: boolean;
  mirrored?: boolean;
}

// Guarded the same way as registerWebRTC.native.ts — react-native-webrtc's
// native module isn't present in Expo Go, and importing it there throws.
let RTCView: React.ComponentType<{
  streamURL: string;
  style?: object;
  objectFit?: 'contain' | 'cover';
  mirror?: boolean;
  zOrder?: number;
}> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RTCView = require('react-native-webrtc').RTCView;
} catch {
  // Native module not linked — falls through to the empty placeholder below.
}

/** Renders a live MediaStream on native via react-native-webrtc's RTCView. */
export function VideoTile({ stream, mirrored }: VideoTileProps) {
  if (!RTCView || !stream) return <View style={styles.fill} />;
  const streamURL = (stream as { toURL: () => string }).toURL();
  return <RTCView streamURL={streamURL} style={styles.fill} objectFit="cover" mirror={mirrored} zOrder={0} />;
}

const styles = StyleSheet.create({
  fill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0B0F07',
  },
});
