import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { throwColor } from '../../theme/throwTokens';
import { isDaytimeAt } from '../../utils/solarTime';
import { latLngAtProgress, planeOpacityForProgress, planeSizeForProgress } from '../../utils/mapProjection';
import { LocationPin } from './LocationPin';
import { PaperPlane } from './PaperPlane';
import type { ThrowMapProps } from './throwMapTypes';
import type { LatLng } from '../../utils/geo';

mapboxgl.accessToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
// A custom Mapbox Studio style ("Faded"), built on Mapbox Standard rather than from scratch — real
// 3D buildings/landmarks and day/night are both handled by the style itself (its Standard "basemap"
// import has `show3dFacades`/`showLandmarkIcons` on and a `lightPreset` config we drive directly,
// see `applyLightPreset` below), not hand-rolled per-layer paint overrides the way the previous
// OpenFreeMap/MapLibre setup needed — Mapbox's own vector tiles/style require this real Mapbox GL
// JS SDK and an access token rather than the MapLibre fork, unlike OpenFreeMap's keyless tiles.
const MAPBOX_STYLE_URL = process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? 'mapbox://styles/mapbox/standard';

// The flying plane's size range — large right after launch, small on approach (see
// `planeSizeForProgress`).
const PLANE_MAX_SIZE = 44;
const PLANE_MIN_SIZE = 16;

// A whole-world-ish default before there's anything to focus on.
const WORLD_CENTER: [number, number] = [10, 15]; // Mapbox wants [lng, lat]
const WORLD_ZOOM = 2;
// How far a single-point focus zooms in, and how steeply it's pitched — picked per explicit user
// request against live screenshots of this exact style. Mapbox GL JS's own default maxPitch is
// already 85 (unlike MapLibre's 60), so no extra construction option is needed to allow it.
const FOCUS_ZOOM = 17;
const FOCUS_PITCH = 70;
// Pixels of *bottom* padding applied to the focus camera — see `applyTarget`'s comment. With no
// padding, `center` always renders at the exact vertical middle of the viewport (confirmed
// directly via `map.project(map.getCenter())`, not assumed). Top padding would push it down (the
// wrong direction for "a little above middle") — bottom padding pushes it up instead, and unlike
// a negative top value (which mapbox-gl's own PaddingOptions validation rejects outright, an
// actual thrown error caught live during testing here), this stays a valid non-negative number.
// 100 lands it around 44% down a typical viewport.
const FOCUS_PADDING_BOTTOM = 100;

const ROUTE_SOURCE_ID = 'throw-route';
const ROUTE_LAYER_ID = 'throw-route-line';

function pointsKey(points: { latitude: number; longitude: number }[] | null | undefined): string {
  return points ? points.map((p) => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`).join('|') : '';
}

type Target = { kind: 'fit'; points: LatLng[] } | { kind: 'focus'; point: LatLng } | null;

// Always an instant jump, never an animated pan/fly — both a `flyTo`-style animation and an
// animated `easeTo` proved unreliable here (back in the Leaflet version, same underlying bug):
// the selected contact can change twice in quick succession right after mount (self location and
// friend data from ThrowContext often resolve a render or two apart), and a second positioning
// call fired while the first's pan animation is still in flight interrupts it, leaving the
// camera stuck wherever the animation had reached — nowhere near either the old or the new
// target. An instant jump has no in-flight state to interrupt, so it's correct regardless of how
// close together these calls land.
function applyTarget(map: mapboxgl.Map, target: Target) {
  if (!target) return;
  if (target.kind === 'fit') {
    const lngs = target.points.map((p) => p.longitude);
    const lats = target.points.map((p) => p.latitude);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 60, duration: 0 },
    );
  } else {
    // `padding` shifts where `center` actually ends up on screen (it renders at the middle of
    // whatever area padding *doesn't* reserve) rather than the raw viewport center — with none
    // set, the focused contact's pin rendered at dead-center, right where the ready-pose plane's
    // own peak sits (see paperPlaneEngine's READY_FRAME_LIFT), overlapping it. Reserving space
    // along the bottom pushes the pin up above that instead, per user request for "a little above
    // true center".
    map.jumpTo({
      center: [target.point.longitude, target.point.latitude],
      zoom: FOCUS_ZOOM,
      pitch: FOCUS_PITCH,
      padding: { top: 0, bottom: FOCUS_PADDING_BOTTOM, left: 0, right: 0 },
    });
  }
}

// Drives the style's own day/night rendering — a config property on its "basemap" (Mapbox
// Standard) import, not a style reload, so this is cheap to call on every flip rather than
// needing the old setStyle-based approach's guard against redundant calls.
function applyLightPreset(map: mapboxgl.Map, isDay: boolean) {
  map.setConfigProperty('basemap', 'lightPreset', isDay ? 'day' : 'night');
}

// Mapbox Standard's own lightPreset switch isn't instant by default — the style ships with a
// multi-second cross-fade transition (a deliberate "time-lapse" showcase for the Standard style),
// which read as the map "not loading fast" whenever a contact switch also flips day/night.
// `Style#setTransition` (undocumented on the public `Map` type but real at runtime — Mapbox's own
// examples use exactly this to zero out the default transition) overrides that default duration
// to 0 so the flip is instant instead, without touching per-layer paint transitions elsewhere.
// Accessed via `map.style` (not on the public `mapboxgl.Map` TS surface) rather than `setStyle`,
// which would trigger a full style reload — same "don't own this internal, degrade quietly"
// defensiveness as applyLightPreset's own try/catch below.
function disableStyleTransitions(map: mapboxgl.Map) {
  (map as unknown as { style?: { setTransition?: (t: { duration: number; delay: number }) => void } }).style?.setTransition?.({
    duration: 0,
    delay: 0,
  });
}

function addOrUpdateRoute(map: mapboxgl.Map, points: LatLng[] | undefined) {
  const coords = points && points.length >= 2 ? points.map((p): [number, number] => [p.longitude, p.latitude]) : null;
  const source = map.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
  if (!coords) {
    source?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } });
    return;
  }
  const data: GeoJSON.Feature<GeoJSON.LineString> = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } };
  if (source) {
    source.setData(data);
  } else {
    map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data });
    map.addLayer({
      id: ROUTE_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': throwColor.clay, 'line-width': 2, 'line-opacity': 0.75, 'line-dasharray': [1, 3.5] },
    });
  }
}

// Recheck often enough that a session left open across a day/night boundary (or a contact
// switch into a different part of the world) still catches up, cheap enough not to matter.
const DAYTIME_RECHECK_MS = 5 * 60 * 1000;

/**
 * The real, interactive world map behind Throw — Mapbox GL JS over a custom Mapbox Studio style,
 * the same Throw-specific props surface as before: a handful of city-level pins plus an optional
 * animated flight route, no GPS accuracy ring or live-share semantics. Pins and the flying plane
 * stay our own React views, absolutely positioned over the map canvas by projecting lat/lng to
 * screen coordinates on every pan/zoom — same reasoning as the previous Leaflet/MapLibre versions
 * (avatar/label rendering handled ourselves rather than by the map library's own marker system).
 * 3D buildings/landmarks and the day/night palette both come from the style itself now (its
 * Mapbox Standard "basemap" import), switched live via `setConfigProperty` rather than the
 * hand-rolled per-layer paint overrides + custom fill-extrusion layer the OpenFreeMap version
 * needed — day/night still follows the *destination's* local solar time (`focus`'s longitude),
 * not the viewer's own clock.
 */
export function ThrowMap({ pins, focus, fitPoints, route }: ThrowMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [, forceRender] = useState(0);

  // Which location's local time governs the day/night palette — the destination being viewed
  // (`focus`), falling back to whichever fit point comes first when only `fitPoints` is set, and
  // to "day" if there's nothing to go on yet (a briefly-wrong palette before location data
  // resolves reads better than defaulting to night).
  const daylightLng = focus?.longitude ?? fitPoints?.[0]?.longitude ?? null;
  const [isDay, setIsDay] = useState(() => (daylightLng === null ? true : isDaytimeAt(daylightLng)));
  const isDayRef = useRef(isDay);
  isDayRef.current = isDay;

  // Always holds whatever `focus`/`fitPoints` currently resolve to — mutated directly during
  // render (not in an effect) so it's never stale by the time a map event callback reads it.
  const targetRef = useRef<Target>(null);
  targetRef.current = fitPoints && fitPoints.length > 0 ? { kind: 'fit', points: fitPoints } : focus ? { kind: 'focus', point: focus } : null;

  const routePointsRef = useRef<LatLng[] | undefined>(undefined);
  routePointsRef.current = route?.points;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLE_URL,
      center: WORLD_CENTER,
      zoom: WORLD_ZOOM,
      pitch: 0,
      // A plain boolean here (unlike MapLibre's `{compact: true}` object) — the compact behavior
      // is a separate AttributionControl added manually right below instead.
      attributionControl: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    const rerender = () => forceRender((n) => n + 1);
    map.on('move', rerender);
    map.on('zoom', rerender);
    map.on('style.load', () => {
      // Defensive, not just tidy: this runs against a style this app doesn't own (edited in
      // Mapbox Studio), so a future rename/removal of the "basemap" import should degrade to
      // "whatever the style's own saved default is" rather than take the whole map down.
      try {
        disableStyleTransitions(map);
        applyLightPreset(map, isDayRef.current);
        addOrUpdateRoute(map, routePointsRef.current);
      } catch (e) {
        console.error('[ThrowMap] failed to apply light preset/route after style load:', e);
      }
      rerender();
    });
    mapRef.current = map;

    // Unlike Live Locations' MapCanvas (a full-screen absoluteFill, already correctly sized the
    // instant its container mounts), this map sits several `flex: 1` levels deep inside
    // ThrowHomeScreen/ThrowFlightScreen — React Native Web's flex layout can still be settling
    // the container's real pixel size well after this effect runs (and after the *first* resize
    // notification too — the container's size can change more than once before it truly
    // settles), so any positioning call issued too early converges on a geographically wrong
    // center that never self-corrects afterward on its own (only the tile viewport does, via
    // `resize()` — not wherever an earlier positioning call already decided to land). Rather than
    // guess which resize event is "the last one", every one of them re-applies whatever the
    // current target is — cheap, and idempotent once the size (and therefore the projected
    // target position) stops changing.
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.resize();
        applyTarget(map, targetRef.current);
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver?.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-position whenever the selected contact (or the flight endpoints) actually changes.
  const fitKey = pointsKey(fitPoints);
  const focusKey = focus ? `${focus.latitude.toFixed(3)},${focus.longitude.toFixed(3)}` : '';
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyTarget(map, targetRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, fitKey]);

  // Recompute the day/night palette whenever the destination changes, and periodically
  // thereafter so a long-open session still catches up.
  useEffect(() => {
    if (daylightLng === null) return;
    const recheck = () => setIsDay(isDaytimeAt(daylightLng));
    recheck();
    const id = setInterval(recheck, DAYTIME_RECHECK_MS);
    return () => clearInterval(id);
  }, [daylightLng]);

  useEffect(() => {
    const map = mapRef.current;
    // Not ready yet on the very first run (the style is still loading asynchronously) — that
    // initial application happens via `style.load` in the mount effect above instead; this only
    // needs to handle isDay flipping *after* the style has already loaded.
    if (!map || !map.isStyleLoaded()) return;
    applyLightPreset(map, isDay);
  }, [isDay]);

  // The route line is a real Mapbox GeoJSON line layer (correct at every zoom without extra
  // math) — only the flying plane glyph itself needs to be a projected DOM overlay, same
  // reasoning as pins.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    addOrUpdateRoute(map, route?.points);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.points]);

  const project = (lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return null;
    const point = map.project([lng, lat]);
    return { x: point.x, y: point.y };
  };

  const planePos = useMemo(() => (route ? latLngAtProgress(route.points, route.progress) : null), [route]);
  const planeScreen = route?.showPlane && planePos ? project(planePos.position.latitude, planePos.position.longitude) : null;
  const planeSize = route ? planeSizeForProgress(route.progress, PLANE_MAX_SIZE, PLANE_MIN_SIZE) : PLANE_MIN_SIZE;
  const planeOpacity = route ? planeOpacityForProgress(route.progress) : 1;

  return (
    <View style={StyleSheet.absoluteFill}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {pins.map((pin) => {
        const pos = project(pin.latitude, pin.longitude);
        if (!pos) return null;
        return (
          <LocationPin
            key={pin.id}
            x={pos.x}
            y={pos.y}
            label={pin.label}
            isSelf={pin.isSelf}
            selected={pin.selected}
            dimmed={pin.dimmed}
            onPress={pin.onPress}
            isNight={!isDay}
          />
        );
      })}

      {planeScreen && planePos && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: planeScreen.x - planeSize / 2,
            top: planeScreen.y - planeSize / 2,
            opacity: planeOpacity,
            transform: [{ rotate: `${planePos.bearingDeg}deg` }],
          }}
        >
          <PaperPlane size={planeSize} color={throwColor.clayDeep} />
        </View>
      )}
    </View>
  );
}
