import React from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Icon } from '../Icon';
import { throwColor } from '../../theme/throwTokens';
import type { StoryMediaType } from '../../types/story';

const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';
const ARROW_ICON = 'M5 12h14M13 6l6 6-6 6';
const CONFIRM_SIZE = 56;

function PreviewVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <VideoView player={player as any} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

interface StoryPreviewScreenProps {
  localUri: string;
  mediaType: StoryMediaType;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Shown right after the camera/gallery hands back a photo or short video, before it's actually
 * posted — previously that media went straight to postStory with no confirmation step at all.
 * The green circle + right-arrow bottom-right (per explicit request with its own reference
 * screenshot) is the only way to actually post; the close button in the top-left discards it and
 * returns to the map, same convention as the capture/trim screens either side of this one.
 */
export function StoryPreviewScreen({ localUri, mediaType, onCancel, onConfirm }: StoryPreviewScreenProps) {
  return (
    <View style={styles.screen}>
      {mediaType === 'photo' ? (
        <Image source={{ uri: localUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <PreviewVideo uri={localUri} />
      )}

      <Pressable onPress={onCancel} hitSlop={12} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Discard">
        <Icon path={CLOSE_ICON} size={22} color="#FFFFFF" strokeWidth={2.2} />
      </Pressable>

      <Pressable onPress={onConfirm} hitSlop={12} style={styles.confirmBtn} accessibilityRole="button" accessibilityLabel="Post to your story">
        <Icon path={ARROW_ICON} size={26} color="#FFFFFF" strokeWidth={2.6} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  closeBtn: {
    position: 'absolute',
    top: Platform.select({ ios: 56, default: 24 }),
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtn: {
    position: 'absolute',
    bottom: 40,
    right: 24,
    width: CONFIRM_SIZE,
    height: CONFIRM_SIZE,
    borderRadius: CONFIRM_SIZE / 2,
    backgroundColor: throwColor.storyRing,
    alignItems: 'center',
    justifyContent: 'center',
    ...throwColor.shadowSoft,
  },
});
