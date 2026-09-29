import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { inboxColor, inboxLayout } from '../../../theme/throwInboxTokens';
import { useThrowColorMode } from '../../../context/ThrowColorModeContext';
import { throwMapNightGoogleStyle } from '../../../theme/throwMapNativeStyle';
import type { InboxMapProps } from './inboxMapTypes';

// Same fixed framing as the web sibling — see its own comment for why this stays flatter/less
// pitched than the main Throw map.
const ZOOM = 9;
const PITCH = 45;
const HEADING = 0;
const PAN_MS = 1100;

function keyOf(p: { latitude: number; longitude: number } | null): string {
  return p ? `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}` : '';
}

/** Same looping pulse ring as the web sibling. */
function PulsingRing() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2.4] });
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });
  return <Animated.View pointerEvents="none" style={[styles.pulseRing, { opacity, transform: [{ scale }] }]} />;
}

/**
 * Native map for the Received Letters screen — react-native-maps, same real-tiles requirement and
 * off-center anchor framing as the web sibling (see its own comment), achieved here via
 * `mapPadding` (react-native-maps' own equivalent of Mapbox's `padding` option) instead of a
 * jumpTo/easeTo padding argument. `animateCamera`'s duration matches the web pan's 1100ms, though
 * react-native-maps doesn't expose a custom cubic-bezier easing curve the way Mapbox GL JS does —
 * its own built-in camera-animation curve is the closest available on this platform.
 */
export function InboxMap({ pins, route, anchor, isDay }: InboxMapProps) {
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { mapIsDay } = useThrowColorMode();
  const anchorKey = keyOf(anchor);

  useEffect(() => {
    if (!mapReady || !anchor) return;
    mapRef.current?.animateCamera({ center: anchor, zoom: ZOOM, pitch: PITCH, heading: HEADING }, { duration: PAN_MS });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey, mapReady]);

  const bottomPad = size.height > 0 ? Math.max(0, size.height * (1 - (2 * inboxLayout.mapAnchor.y) / inboxLayout.phone.height)) : 0;

  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialCamera={anchor ? { center: anchor, zoom: ZOOM, pitch: PITCH, heading: HEADING } : undefined}
        mapPadding={{ top: 0, right: 0, bottom: bottomPad, left: 0 }}
        pitchEnabled
        userInterfaceStyle={mapIsDay ? 'light' : 'dark'}
        customMapStyle={mapIsDay ? [] : throwMapNightGoogleStyle}
        onMapReady={() => setMapReady(true)}
      >
        {route.length >= 2 && (
          <Polyline coordinates={route} strokeColor="rgba(17,17,17,.28)" strokeWidth={2.5} lineDashPattern={[2, 8]} lineCap="round" />
        )}
        {pins.map((pin) => {
          const dotSize = pin.active ? 24 : 14;
          return (
            <Marker key={pin.id} coordinate={{ latitude: pin.latitude, longitude: pin.longitude }} zIndex={pin.active ? 10 : 1} tracksViewChanges anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.pinWrap}>
                {pin.active && <PulsingRing />}
                <View style={[styles.pinDot, { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: pin.active ? inboxColor.accentBlue : inboxColor.ink }]} />
                {pin.active && pin.label && (
                  <View style={styles.pinLabelWrap}>
                    <Animated.Text style={styles.pinLabel}>{pin.label}</Animated.Text>
                  </View>
                )}
              </View>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  pinWrap: { alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(47,107,255,.35)' },
  pinDot: { borderWidth: 3, borderColor: '#FFFFFF' },
  pinLabelWrap: { position: 'absolute', left: 18, top: -11 },
  pinLabel: {
    fontFamily: 'DMMono_500Medium',
    fontSize: 10,
    letterSpacing: 1,
    color: '#FFFFFF',
    backgroundColor: '#111111',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
});
