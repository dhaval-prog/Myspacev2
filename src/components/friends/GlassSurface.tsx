import React from 'react';
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

interface GlassSurfaceProps extends ViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 'dark' for the ink surfaces (Radar banner, chat header, QR panel); 'light' for translucent-white cards. */
  tint?: 'light' | 'dark';
  /** Overlay color layered on top of the blur — carries most of the "glass" color since blur alone stays neutral. */
  tintColor: string;
}

/**
 * A frosted-glass surface: a real-time BlurView backdrop plus a translucent
 * tint on top, meant to replace a flat opaque/semi-opaque background color.
 * `style` supplies the shape (border radius, padding, border, shadow) —
 * this component only supplies the glass fill, so callers keep full control
 * of layout the way a plain `View` would. Any other `View` prop (e.g.
 * `onLayout`) passes straight through to the outer container.
 */
export function GlassSurface({ children, style, tint = 'light', tintColor, ...rest }: GlassSurfaceProps) {
  return (
    <View style={[styles.base, style]} {...rest}>
      <BlurView intensity={tint === 'dark' ? 42 : 30} tint={tint} style={[StyleSheet.absoluteFill, styles.layer]} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, styles.layer, { backgroundColor: tintColor }]} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  // A live TextInput (a real <input> on web) otherwise renders blurred —
  // its native stacking doesn't reliably paint above an absolutely
  // positioned sibling the way plain Views/Text do — so the blur/tint
  // layers get an explicit negative zIndex, keeping real content (at the
  // default zIndex of 0) painted above them without needing to wrap
  // children in an extra layout-changing View.
  layer: {
    zIndex: -1,
  },
});
