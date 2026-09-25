import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';
import { throwColor } from '../../theme/throwTokens';
import { latLngAtProgress, planeOpacityForProgress, planeSizeForProgress } from '../../utils/mapProjection';
import { LocationPinGlyph } from './LocationPin';
import { PaperPlane } from './PaperPlane';
import type { ThrowMapProps } from './throwMapTypes';

// A whole-world-ish default before there's anything to focus on — not literally the whole globe
// (MapView clamps oddly past ~170°), just wide enough to read as "the world" rather than a random
// close-up.
const WORLD_REGION: Region = { latitude: 15, longitude: 10, latitudeDelta: 140, longitudeDelta: 140 };
// The flying plane's size range — large right after launch, small on approach (see
// `planeSizeForProgress`).
const PLANE_MAX_SIZE = 44;
const PLANE_MIN_SIZE = 16;

// A tilted camera, matching the web map's own 3D-scene treatment — react-native-maps supports a
// real camera pitch (Apple Maps and Google Maps both render actual perspective, not a CSS trick,
// so this one's genuinely 3D rather than the web map's simulated tilt).
const CAMERA_PITCH = 55;
// How far a single-point focus zooms in — city scale (Throw's location data is a city-level
// lat/lng, not live GPS, so this stays short of Live Locations' street-level 0.02). A delta of 8
// was tried first and was wrong: that's an 8°-wide region — roughly Pune to Bhopal to Jaipur all
// visible at once — so the map's own place labels are dominated by whichever neighboring cities
// happen to be biggest, and the actual focused city's name never appears at all. The pin's
// coordinate was correct, but nothing on the map read as "this is the right place."
const FOCUS_DELTA = { latitudeDelta: 0.4, longitudeDelta: 0.4 };

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
  // `onMapReady` (not just a mounted ref) is what actually gates safe imperative calls here — a
  // ref can be attached to the native view before the underlying map surface is ready, in which
  // case `animateToRegion`/`fitToCoordinates` can silently no-op or resolve into a wrong camera
  // position. Selection typically resolves to a real friend one render tick after this component
  // mounts (ThrowHomeScreen's initial-selection effect runs after paint), i.e. exactly when
  // `initialRegion` can no longer help (it only applies at first mount) and these imperative
  // calls are the only way to get the camera to the right place — so silently dropping the very
  // first one leaves the map stuck wherever `initialRegion` happened to land.
  const [mapReady, setMapReady] = useState(false);

  // Instant jumps only, never animated — mirrors the web map's fix for the same underlying bug:
  // the selected contact can resolve twice in quick succession right after mount (self location,
  // then friend data a render or two later), and a second positioning call fired while an
  // animation from the first is still in flight gets interrupted, leaving the camera at a
  // nonsensical intermediate position that matches neither target. `animated: false` /
  // `animateToRegion(..., 0)` have no in-flight state to interrupt, so they're correct regardless
  // of how close together these calls land.
  useEffect(() => {
    if (!mapReady || !fitPoints || fitPoints.length === 0) return;
    mapRef.current?.fitToCoordinates(fitPoints, {
      edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
      animated: false,
    });
    // fitToCoordinates re-derives the camera from the coordinate bounds, which resets pitch back
    // to 0 — reassert the tilt every time a positioning call could have clobbered it, same
    // instant-no-animation reasoning as the region call itself.
    mapRef.current?.setCamera({ pitch: CAMERA_PITCH });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    if (fitPoints && fitPoints.length > 0) return;
    if (!focus) return;
    mapRef.current?.animateToRegion({ latitude: focus.latitude, longitude: focus.longitude, ...FOCUS_DELTA }, 0);
    mapRef.current?.setCamera({ pitch: CAMERA_PITCH });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, fitKey, mapReady]);

  const planePos = useMemo(() => (route ? latLngAtProgress(route.points, route.progress) : null), [route]);
  const planeSize = route ? planeSizeForProgress(route.progress, PLANE_MAX_SIZE, PLANE_MIN_SIZE) : PLANE_MIN_SIZE;
  const planeOpacity = route ? planeOpacityForProgress(route.progress) : 1;

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={focus ? { ...focus, ...FOCUS_DELTA } : WORLD_REGION}
      initialCamera={{
        center: focus ?? { latitude: WORLD_REGION.latitude, longitude: WORLD_REGION.longitude },
        pitch: CAMERA_PITCH,
        heading: 0,
        zoom: focus ? 10 : 2,
      }}
      pitchEnabled
      onMapReady={() => {
        setMapReady(true);
        mapRef.current?.setCamera({ pitch: CAMERA_PITCH });
      }}
    >
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
        <Marker coordinate={planePos.position} anchor={{ x: 0.5, y: 0.5 }} zIndex={3} tracksViewChanges={true} opacity={planeOpacity}>
          <View style={{ transform: [{ rotate: `${planePos.bearingDeg}deg` }] }}>
            <PaperPlane size={planeSize} color={throwColor.clayDeep} />
          </View>
        </Marker>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pinWrap: { alignItems: 'center', justifyContent: 'center' },
});
