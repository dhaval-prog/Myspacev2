import React from 'react';
import { Platform, Pressable, View, type GestureResponderEvent } from 'react-native';

interface FriendsMapPinAnchorProps {
  /** The glyph's natural rendered width, so the web canvas (which positions this view's top-left
   * at the pin's exact screen coordinate — see FriendsMapCanvas.web.tsx) can center it instead. */
  width: number;
  /** How far up from the coordinate the glyph's "tip" (the bottom of its tail) sits — e.g. the
   * avatar's own height, since the tail hangs below it. Only matters on web; the native canvas
   * instead gives its `<Marker>` a fixed anchor fraction (see FriendsMapCanvas.native.tsx), since
   * react-native-maps positions Marker content itself rather than this view doing it by hand. */
  tipOffset: number;
  onPress?: (e: GestureResponderEvent) => void;
  children: React.ReactNode;
}

/**
 * Centers/tip-anchors a pin or cluster glyph over the coordinate the map canvas positioned this
 * view at. The web canvas hands every pin a zero-size `{left, top}` anchor view (mirroring the
 * design handoff's own `width:0;height:0` pin wrapper) and expects its child to self-offset; the
 * native canvas instead renders pins inside a `<Marker>`, which already anchors/positions its
 * content itself — so this is a no-op there, just the tap target.
 */
export function FriendsMapPinAnchor({ width, tipOffset, onPress, children }: FriendsMapPinAnchorProps) {
  const content = <Pressable onPress={onPress} hitSlop={8}>{children}</Pressable>;
  if (Platform.OS !== 'web') return content;
  return (
    <View style={{ position: 'absolute', left: -width / 2, top: -tipOffset, width, alignItems: 'center' }} pointerEvents="box-none">
      {content}
    </View>
  );
}
