import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../Icon';

const CLOSE_ICON = 'M6 6l12 12M18 6 6 18';
const BACK_ICON = 'M15 5l-7 7 7 7';
const BANNER_ROTATE_MS = 2600;
const FADE_MS = 380;

export interface MediaItem {
  id: string;
  url: string;
  senderId: string;
}

interface MediaGalleryModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Caption shown over the shuffling banner — the group's or friend's name. */
  bannerCaption: string;
  items: MediaItem[];
  /** Display name for a sender id — "You" for the signed-in account, a friend's or member's name otherwise. */
  senderNameFor: (senderId: string) => string;
}

/** A crossfading slideshow of every photo passed in, cycling on its own. */
function ShuffleBanner({ items, caption }: { items: MediaItem[]; caption: string }) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (items.length < 2) return;
    const timer = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => {
        setIndex((i) => (i + 1) % items.length);
        Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      });
    }, BANNER_ROTATE_MS);
    return () => clearInterval(timer);
  }, [items.length, opacity]);

  const current = items[index % items.length];
  if (!current) return null;

  return (
    <View style={styles.banner}>
      <Animated.Image source={{ uri: current.url }} style={[styles.bannerImage, { opacity }]} resizeMode="cover" />
      <View style={styles.bannerOverlay} />
      <Text style={styles.bannerCaption} numberOfLines={1}>
        {caption}
      </Text>
    </View>
  );
}

/** Every photo shared in one thread or group — an overview grouped by who shared it (with a shuffling banner up top), drilling into one member's own photos. */
export function MediaGalleryModal({ visible, onClose, title, bannerCaption, items, senderNameFor }: MediaGalleryModalProps) {
  const insets = useSafeAreaInsets();
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) setSelectedSenderId(null);
  }, [visible]);

  const senderIds = Array.from(new Set(items.map((it) => it.senderId)));
  const tileForSender: Record<string, MediaItem> = {};
  for (const item of items) {
    if (!tileForSender[item.senderId]) tileForSender[item.senderId] = item;
  }
  const selectedItems = selectedSenderId ? items.filter((it) => it.senderId === selectedSenderId) : [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.header}>
          {selectedSenderId ? (
            <Pressable onPress={() => setSelectedSenderId(null)} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Back to Media">
              <Icon path={BACK_ICON} color={colors.textPrimary} size={18} strokeWidth={2} />
            </Pressable>
          ) : (
            <View style={styles.closeButtonSpacer} />
          )}
          <Text style={styles.title} numberOfLines={1}>
            {selectedSenderId ? senderNameFor(selectedSenderId) : title}
          </Text>
          <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close media">
            <Icon path={CLOSE_ICON} color={colors.textPrimary} size={18} strokeWidth={2} />
          </Pressable>
        </View>

        {items.length === 0 ? (
          <Text style={styles.empty}>No photos shared here yet.</Text>
        ) : selectedSenderId ? (
          <ScrollView contentContainerStyle={[styles.grid, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            {selectedItems.map((item) => (
              <Pressable key={item.id} onPress={() => setPreview(item.url)} style={styles.thumbWrap} accessibilityRole="button" accessibilityLabel="Open photo">
                <Image source={{ uri: item.url }} style={styles.thumb} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, spacing.lg) }}>
            <View style={styles.bannerWrap}>
              <ShuffleBanner items={items} caption={bannerCaption} />
            </View>

            <Text style={styles.sectionLabel}>People</Text>
            <View style={styles.peopleGrid}>
              {senderIds.map((id) => {
                const name = senderNameFor(id);
                return (
                  <Pressable
                    key={id}
                    onPress={() => setSelectedSenderId(id)}
                    style={styles.personTile}
                    accessibilityRole="button"
                    accessibilityLabel={`${name}'s photos`}
                  >
                    <Image source={{ uri: tileForSender[id].url }} style={styles.personImage} resizeMode="cover" />
                    <View style={styles.personOverlay} />
                    <Text style={styles.personName} numberOfLines={1}>
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
  },
  title: {
    flex: 1,
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
  closeButtonSpacer: {
    width: 38,
    height: 38,
  },
  empty: {
    marginTop: spacing.xxl,
    textAlign: 'center',
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  bannerWrap: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  banner: {
    height: 230,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.badgeInactiveBg,
    justifyContent: 'flex-end',
  },
  bannerImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bannerCaption: {
    padding: spacing.md,
    fontFamily: fontFamily.sans700,
    fontSize: 16,
    color: '#fff',
  },
  sectionLabel: {
    paddingHorizontal: spacing.md + 4,
    marginBottom: spacing.sm,
    fontFamily: fontFamily.sans700,
    fontSize: 20,
    color: colors.textPrimary,
  },
  peopleGrid: {
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  personTile: {
    width: '32%',
    aspectRatio: 0.85,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.badgeInactiveBg,
    justifyContent: 'flex-end',
  },
  personImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  personOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 44,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  personName: {
    padding: 8,
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: '#fff',
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
