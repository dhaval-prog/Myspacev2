import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { ghColor } from '../../theme/gamesHubTokens';

interface HubSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  reduceMotion?: boolean;
}

/** Shared rising bottom sheet + scrim for the Games hub's Leaderboard and Points sheets — same one-sheet-at-a-time pattern as the handoff's shared paintSheets(). */
export function HubSheet({ visible, onClose, children, reduceMotion }: HubSheetProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: visible ? 1 : 0, duration: reduceMotion ? 0 : 320, useNativeDriver: true }).start();
  }, [visible, reduceMotion, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.scrim, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <BlurView intensity={50} tint="light" style={[StyleSheet.absoluteFill, { zIndex: -1 }]} pointerEvents="none" />
        <View style={styles.sheetTint} pointerEvents="none" />
        <View style={styles.handle} />
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: ghColor.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '86%',
    overflow: 'hidden',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: ghColor.sheetBorder,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    shadowColor: ghColor.ink,
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: -18 },
    shadowRadius: 44,
  },
  sheetTint: { position: 'absolute', zIndex: -1, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: ghColor.sheetBg },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: ghColor.sheetHandle, marginBottom: 16 },
});
