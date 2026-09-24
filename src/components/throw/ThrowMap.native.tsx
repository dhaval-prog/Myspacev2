import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';
import { throwColor } from '../../theme/throwTokens';
import { latLngAtProgress } from '../../utils/mapProjection';
import { LocationPinGlyph } from './LocationPin';
import { PaperPlane } from './PaperPlane';
import type { ThrowMapProps } from './throwMapTypes';

// A whole-world-ish default before there's anything to focus on — not literally the whole globe
// (MapView clamps oddly past ~170°), just wide enough to read as "the world" rather than a random
// close-up.
const WORLD_REGION: Region = { latitude: 15, longitude: 10, latitudeDelta: 140, longitudeDelta: 140 };
// How far a single-point focus zooms in — regional/multi-city scale (Throw's location data is a
// city-level lat/lng, not live GPS, so this stays well short of Live Locations' street-level 0.02).
const FOCUS_DELTA = { latitudeDelta: 8, longitudeDelta: 8 };
const FOCUS_DURATION_MS = 500;

function pointsKey(points: { latitude: number; longitude: number }[] | null | undefined): string {
  return points ? points.map((p) => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`).join('|') : '';
}

/** The real, interactive world map behind Throw — react-native-maps (Apple Maps on iOS out of the
 * box, Google Maps on Android once a Maps API key is added to app.json), same underlying stack as
 * Live Locations' MapCanvas but with a Throw-specific props surface: a handful of city-level pins
 * plus an optional animated flight route, no GPS accuracy ring or live-share semantics. */
export function ThrowMap({ pins, focus, fitPoints, route }: ThrowMapProps) {
  const mapRef = useRef<MapView>(null);
  const fitKey = pointsKey(fitPoints);
  const focusKey = focus ? `${focus.latitude.toFixed(3)},${focus.longitude.toFixed(3)}` : '';

  useEffect(() => {
    if (!fitPoints || fitPoints.length === 0) return;
    mapRef.current?.fitToCoordinates(fitPoints, {
      edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
      animated: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  useEffect(() => {
    if (fitPoints && fitPoints.length > 0) return;
    if (!focus) return;
    mapRef.current?.animateToRegion({ latitude: focus.latitude, longitude: focus.longitude, ...FOCUS_DELTA }, FOCUS_DURATION_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, fitKey]);

  const planePos = useMemo(() => (route ? latLngAtProgress(route.points, route.progress) : null), [route]);

  return (
    <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={focus ? { ...focus, ...FOCUS_DELTA } : WORLD_REGION}>
      {route && (
        <Polyline
          coordinates={route.points}
          strokeColor={throwColor.clay}
          strokeWidth={2}
          lineDashPattern={[1, 7]}
          lineCap="round"
        />
      )}

      {/* tracksViewChanges stays true — the same custom-marker-content pattern (and reasoning)
          as MapCanvas.native.tsx: a false value can leave a permanently blank pin snapshotted
          before layout, and here it's also what lets the plane marker's rotation actually
          repaint every frame it moves. */}
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
          onPress={pin.onPress}
          zIndex={pin.selected ? 2 : 1}
          tracksViewChanges={true}
          // LocationPinGlyph's dot (the actual point) sits near the top of its own box, above
          // the label — anchor the marker there instead of react-native-maps' bottom-center
          // default, which would put the geo-coordinate down at the label's baseline.
          anchor={{ x: 0.5, y: 0.18 }}
        >
          <View style={styles.pinWrap}>
            <LocationPinGlyph label={pin.label} isSelf={pin.isSelf} selected={pin.selected} dimmed={pin.dimmed} />
          </View>
        </Marker>
      ))}

      {route?.showPlane && planePos && (
        <Marker coordinate={planePos.position} anchor={{ x: 0.5, y: 0.5 }} zIndex={3} tracksViewChanges={true}>
          <View style={{ transform: [{ rotate: `${planePos.bearingDeg}deg` }] }}>
            <PaperPlane size={26} color={throwColor.clayDeep} />
          </View>
        </Marker>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pinWrap: { alignItems: 'center', justifyContent: 'center' },
});
