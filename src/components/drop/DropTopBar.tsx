import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../Icon';
import { DropPress } from './DropPress';
import { Kick } from './DropText';
import { dpColor } from '../../theme/dropTokens';

const BACK_ICON = 'M15 18l-6-6 6-6';

interface DropTopBarProps {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}

/** Frosted sticky header used on pushed (non-hub) Drop screens — content below must reserve `insets.top + 52` of top padding. */
export function DropTopBar({ title, onBack, right }: DropTopBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { height: insets.top + 52, paddingTop: insets.top }]}>
      <BlurView intensity={32} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.55)' }]} pointerEvents="none" />
      <View style={styles.row}>
        <DropPress onPress={onBack} scale={false} style={styles.backBtn} accessibilityLabel="Back">
          <Icon path={BACK_ICON} color={dpColor.ink} size={20} strokeWidth={2} />
        </DropPress>
        <Kick style={styles.title}>{title}</Kick>
        <View style={styles.right}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: dpColor.line },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, justifyContent: 'space-between' },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: dpColor.surfaceSoft, borderWidth: 1, borderColor: dpColor.line, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 11, letterSpacing: 1.5, color: dpColor.inkSoft },
  right: { width: 38, height: 38 },
});
