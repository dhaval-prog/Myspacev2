import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

interface VideoTileProps {
  stream: MediaStream | null;
  muted?: boolean;
  mirrored?: boolean;
}

/** Renders a live MediaStream — web only, backed by a raw DOM <video> element imperatively attached to the View's underlying div. */
export function VideoTile({ stream, muted, mirrored }: VideoTileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    container.appendChild(video);
    videoRef.current = video;
    return () => {
      container.removeChild(video);
      videoRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = !!muted;
  }, [muted]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.style.transform = mirrored ? 'scaleX(-1)' : 'none';
  }, [mirrored]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return <View ref={containerRef as unknown as React.Ref<View>} style={styles.fill} />;
}

const styles = StyleSheet.create({
  fill: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#0B0F07',
  },
});
