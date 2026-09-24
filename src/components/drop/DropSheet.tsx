import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Kick } from './DropText';
import { dpColor, dpRadius, dpShadow, dpSpace } from '../../theme/dropTokens';

interface DropSheetProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** The bottom-sheet modal shell — timing-based rise (340ms, ease-out cubic-bezier), light blur backdrop. */
export function DropSheet({ visible, title, onClose, children }: DropSheetProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(progress, { toValue: 1, duration: 340, easing: Easing.bezier(0.22, 0.9, 0.3, 1), useNativeDriver: true }).start();
    } else {
      progress.setValue(0);
    }
  }, [visible, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={2} style={StyleSheet.absoluteFill} />
      </Pressable>
      <Animated.View style={[styles.panel, { transform: [{ translateY }] }]}>
        <View style={styles.handle} />
        {title ? <Kick style={styles.title}>{title}</Kick> : null}
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(40,28,50,0.4)' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: dpColor.surface,
    borderTopLeftRadius: dpRadius.cardLg + 2,
    borderTopRightRadius: dpRadius.cardLg + 2,
    paddingHorizontal: dpSpace.gutter,
    paddingTop: 12,
    paddingBottom: 26,
    ...dpShadow.shadowPop,
  },
  handle: { alignSelf: 'center', width: 40, height: 4.5, borderRadius: 3, backgroundColor: dpColor.sunken, marginBottom: 16 },
  title: { textAlign: 'center', marginBottom: 14 },
});
