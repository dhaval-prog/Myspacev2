import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';
import { throwColor } from '../../theme/throwTokens';
import { throwMapNightGoogleStyle } from '../../theme/throwMapNativeStyle';
import { isDaytimeAt } from '../../utils/solarTime';
import { latLngAtProgress, planeOpacityForProgress, planeSizeForProgress } from '../../utils/mapProjection';
import { LocationPinGlyph } from './LocationPin';
import { PaperPlane } from './PaperPlane';
import type { ThrowMapProps } from './throwMapTypes';

// A whole-world-ish default before there's anything to focus on — not literally the whole globe
// (MapView clamps oddly past ~170°), just wide enough to read as "the world" rather than a random
// close-up.
const WORLD_REGION: Region = { latitude: 15, longitude: 10, latitudeDelta: 140, longitudeDelta: 140 };
// The flying plane's size range — large right after launch, small on approach (see
// `planeSizeForProgress`). City-level data doesn't warrant a literal 3D perspective projection,
// just a readable "it's getting farther away" cue.
const PLANE_MAX_SIZE = 44;
const PLANE_MIN_SIZE = 16;
// How far a single-point focus zooms in, and how steeply it's pitched — matching the web
// MapLibre version's FOCUS_ZOOM 14.6 / FOCUS_PITCH 50 (the two aren't directly comparable units —
// this delta is a region-size approximation of that same framing, scaled from an earlier round's
// 0.006/zoom-17 pairing by the standard "each zoom level roughly halves the visible extent" rule
// — 2^(17-14.6) ≈ 5.3× wider — not independently retuned against a live render the way the web
// zoom/pitch values were).
const FOCUS_DELTA = { latitudeDelta: 0.032, longitudeDelta: 0.032 };
const FOCUS_PITCH = 50;

function pointsKey(points: { latitude: number; longitude: number }[] | null | undefined): string {
  return points ? points.map((p) => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`).join('|') : '';
}

// Recheck often enough that a session left open across a day/night boundary (or a contact switch
// into a different part of the world) still catches up, cheap enough not to matter.
const DAYTIME_RECHECK_MS = 5 * 60 * 1000;

/** The real, interactive world map behind Throw — react-native-maps (Apple Maps on iOS out of the
 * box, Google Maps on Android once a Maps API key is added to app.json), same underlying stack as
 * Live Locations' MapCanvas but with a Throw-specific props surface: a handful of city-level pins
 * plus an optional animated flight route, no GPS accuracy ring or live-share semantics. Day/night
 * follows the destination's (`focus`'s) local solar time, same as the web version, though the
 * mechanism is entirely different here — each platform's own built-in styling hook rather than a
 * MapLibre layer repaint, since react-native-maps has no equivalent. 3D buildings are similarly
 * platform-native rather than a layer this file adds: Apple Maps renders its own once pitched and
 * zoomed in close, with nothing further to wire up here. */
export function ThrowMap({ pins, focus, fitPoints, route }: ThrowMapProps) {
  const mapRef = useRef<MapView>(null);
  const fitKey = pointsKey(fitPoints);
  const focusKey = focus ? `${focus.latitude.toFixed(3)},${focus.longitude.toFixed(3)}` : '';

  // Which location's local time governs the day/night palette — the destination being viewed
  // (`focus`), falling back to whichever fit point comes first when only `fitPoints` is set, and
  // to "day" if there's nothing to go on yet (a briefly-wrong palette before location data
  // resolves reads better than defaulting to night). Same reasoning and same helper as the web
  // MapLibre version, so both platforms agree on which half of the day a contact is in.
  const daylightLng = focus?.longitude ?? fitPoints?.[0]?.longitude ?? null;
  const [isDay, setIsDay] = useState(() => (daylightLng === null ? true : isDaytimeAt(daylightLng)));
  useEffect(() => {
    if (daylightLng === null) return;
    const recheck = () => setIsDay(isDaytimeAt(daylightLng));
    recheck();
    const id = setInterval(recheck, DAYTIME_RECHECK_MS);
    return () => clearInterval(id);
  }, [daylightLng]);
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
    // to 0 — reassert it every time a positioning call could have clobbered it.
    mapRef.current?.setCamera({ pitch: FOCUS_PITCH });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    if (fitPoints && fitPoints.length > 0) return;
    if (!focus) return;
    mapRef.current?.animateToRegion({ latitude: focus.latitude, longitude: focus.longitude, ...FOCUS_DELTA }, 0);
    mapRef.current?.setCamera({ pitch: FOCUS_PITCH });
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
      initialCamera={
        focus
          ? { center: focus, pitch: FOCUS_PITCH, heading: 0, zoom: 14.6 }
          : { center: { latitude: WORLD_REGION.latitude, longitude: WORLD_REGION.longitude }, pitch: 0, heading: 0, zoom: 2 }
      }
      onMapReady={() => {
        setMapReady(true);
        if (focus) mapRef.current?.setCamera({ pitch: FOCUS_PITCH });
      }}
      // Lets Apple Maps (iOS) render its own automatic 3D building extrusion at this close,
      // pitched-by-default framing — no separate opt-in beyond allowing the gesture/camera;
      // there's no MapLibre-style custom layer to add here, this is entirely the platform map's
      // own rendering. Google Maps on Android doesn't extrude real building geometry the way
      // Apple Maps or the web MapLibre version do, so this mostly benefits iOS.
      pitchEnabled
      // Day/night, one mechanism per platform: `userInterfaceStyle` switches Apple Maps' own
      // built-in dark rendering (iOS-only prop, silently ignored on Android); `customMapStyle`
      // is Google Maps' JSON styling hook (ignored by Apple Maps) — see throwMapNativeStyle.ts
      // for why its colors are the same locked palette as the web version's, not eyeballed anew.
      userInterfaceStyle={isDay ? 'light' : 'dark'}
      customMapStyle={isDay ? [] : throwMapNightGoogleStyle}
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
