import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { fmColor, fmLayout, fmShadow } from '../../../theme/friendsMapTokens';

interface FriendsMapControlsProps {
  top: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitAll: () => void;
  onLocateMe: () => void;
}

/** Right-edge zoom stack / fit-all / locate-me buttons (§5 of the handoff). */
export function FriendsMapControls({ top, onZoomIn, onZoomOut, onFitAll, onLocateMe }: FriendsMapControlsProps) {
  const size = fmLayout.mapControlSize;
  return (
    <View style={[styles.col, { top }]}>
      <View style={[styles.zoomStack, fmShadow.soft, { borderRadius: size / 2 }]}>
        <Pressable onPress={onZoomIn} style={[styles.zoomBtn, { width: size, height: size }]} accessibilityRole="button" accessibilityLabel="Zoom in">
          <Text style={styles.zoomGlyph}>+</Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable onPress={onZoomOut} style={[styles.zoomBtn, { width: size, height: size }]} accessibilityRole="button" accessibilityLabel="Zoom out">
          <Text style={styles.zoomGlyph}>−</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={onFitAll}
        style={[styles.circleBtn, fmShadow.soft, { width: size, height: size, borderRadius: size / 2, backgroundColor: fmColor.white }]}
        accessibilityRole="button"
        accessibilityLabel="Fit all friends"
      >
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={fmColor.ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </Svg>
      </Pressable>
      <Pressable
        onPress={onLocateMe}
        style={[styles.circleBtn, { width: size, height: size, borderRadius: size / 2, backgroundColor: fmColor.meBlue, shadowColor: fmColor.meBlue, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 8 }, shadowRadius: 20 }]}
        accessibilityRole="button"
        accessibilityLabel="Center on me"
      >
        <Svg width={20} height={20} viewBox="0 0 24 24" fill={fmColor.white}>
          <Path d="M21 3L3 10.5l7.5 3 3 7.5z" />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  col: { position: 'absolute', right: 16, gap: 8 },
  zoomStack: { flexDirection: 'column', backgroundColor: fmColor.white, overflow: 'hidden' },
  zoomBtn: { alignItems: 'center', justifyContent: 'center' },
  zoomGlyph: { fontFamily: 'Figtree_500Medium', fontSize: 24, color: fmColor.ink },
  divider: { height: 1, marginHorizontal: 10, backgroundColor: 'rgba(22,33,12,0.08)' },
  circleBtn: { alignItems: 'center', justifyContent: 'center' },
});
