import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../Icon';

const CLOSE_ICON = 'M6 6l12 12M18 6 6 18';

export interface MediaItem {
  id: string;
  url: string;
}

interface MediaGalleryModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  items: MediaItem[];
}

/** Every photo shared in one thread or group, newest first — opened from the "+" attach sheet. */
export function MediaGalleryModal({ visible, onClose, title, items }: MediaGalleryModalProps) {
  const insets = useSafeAreaInsets();
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close media">
            <Icon path={CLOSE_ICON} color={colors.textPrimary} size={18} strokeWidth={2} />
          </Pressable>
        </View>

        {items.length === 0 ? (
          <Text style={styles.empty}>No photos shared here yet.</Text>
        ) : (
          <ScrollView contentContainerStyle={[styles.grid, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setPreview(item.url)}
                style={styles.thumbWrap}
                accessibilityRole="button"
                accessibilityLabel="Open photo"
              >
                <Image source={{ uri: item.url }} style={styles.thumb} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.previewWrap} onPress={() => setPreview(null)} accessibilityRole="button" accessibilityLabel="Close preview">
          {preview && <Image source={{ uri: preview }} style={styles.previewImage} resizeMode="contain" />}
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 19,
    color: colors.textPrimary,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.pressWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    marginTop: spacing.xxl,
    textAlign: 'center',
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  grid: {
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  thumbWrap: {
    width: '32%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.badgeInactiveBg,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  previewWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '80%',
  },
});
