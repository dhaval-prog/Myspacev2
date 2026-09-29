import React from 'react';
import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

/** A muted, looping, autoplaying video filling its parent — shared by StoryPreviewScreen (before
 * posting), ContactStoryStack (a posted status), and LetterFoldCard's own polaroid viewer (a
 * letter's video attachment), so all three render a story/attachment video identically instead of
 * three near-duplicate `useVideoPlayer`/`VideoView` copies drifting out of sync. */
export function AutoplayVideoFill({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <VideoView player={player as any} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} pointerEvents="none" />;
}
