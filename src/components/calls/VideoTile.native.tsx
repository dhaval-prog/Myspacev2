import React from 'react';
import { StyleSheet, View } from 'react-native';

interface VideoTileProps {
  stream: unknown;
  muted?: boolean;
  mirrored?: boolean;
}

/** Native video calling isn't wired up yet — this just holds the tile's place. */
export function VideoTile(_props: VideoTileProps) {
  return <View style={styles.fill} />;
}

const styles = StyleSheet.create({
  fill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0B0F07',
  },
});
