import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { throwColor } from '../../theme/throwTokens';
import { throwMapDayColor, throwMapNightColor, throwMapStyleUrl } from '../../theme/throwMapTokens';
import { isDaytimeAt } from '../../utils/solarTime';
import { latLngAtProgress, planeOpacityForProgress, planeSizeForProgress } from '../../utils/mapProjection';
import { LocationPin } from './LocationPin';
import { PaperPlane } from './PaperPlane';
import type { ThrowMapProps } from './throwMapTypes';
import type { LatLng } from '../../utils/geo';

// The flying plane's size range — large right after launch, small on approach (see
// `planeSizeForProgress`).
const PLANE_MAX_SIZE = 44;
const PLANE_MIN_SIZE = 16;

// A whole-world-ish default before there's anything to focus on.
const WORLD_CENTER: [number, number] = [10, 15]; // MapLibre wants [lng, lat]
const WORLD_ZOOM = 2;
// How far a single-point focus zooms in, and how steeply it's pitched — a close, tilted default
// per user request, explicitly choosing the "this reads as precisely where your friend is" look
// over the earlier city-level-only framing (FOCUS_ZOOM was 11, unpitched, so buildings — which
// only render from zoom 14 up — never showed until someone zoomed in themselves). Both numbers
// were picked empirically against a live render, not guessed: zoom 17 is close enough that
// buildings clearly stand up without the view degrading into a single oversized rooftop (that
// starts around 19), and pitch 75 needs `maxPitch` raised on map creation below, since
// MapLibre's own default caps out at 60.
const FOCUS_ZOOM = 17;
const FOCUS_PITCH = 75;
// At FOCUS_PITCH, the top ~30% of an unmodified viewport is empty sky — per user request, that
// band gets cropped out entirely rather than left visible above the buildings. Achieved by
// rendering the MapLibre canvas taller than the visible frame (extra height added above,
// clipped by `overflow: hidden` on the wrapping view below) so the horizon lands off the top
// edge — not a CSS trick applied to a screenshot, an always-on render adjustment, so pins/the
// plane (positioned via `map.project`, which reports coordinates in the *canvas's* own frame)
// need their Y coordinate corrected by the same crop amount to still land in the right spot in
// the visible frame; see `cropPx` below. 35% was picked empirically (tested against 700/900/1200px
// viewport heights, all clean with margin above the ~30% minimum that still showed a sliver) —
// expressed as a fraction of the visible height rather than a fixed pixel count so it scales
// correctly across device sizes, unlike a flat px crop tuned for one viewport.
const SKY_CROP_FRACTION = 0.35;

const ROUTE_SOURCE_ID = 'throw-route';
const ROUTE_LAYER_ID = 'throw-route-line';
const BUILDINGS_LAYER_ID = 'throw-3d-buildings';

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
function applyTarget(map: maplibregl.Map, target: Target) {
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
    map.jumpTo({ center: [target.point.longitude, target.point.latitude], zoom: FOCUS_ZOOM, pitch: FOCUS_PITCH });
  }
}

/** Adds the day/night color overrides for whichever style just (re)loaded, plus the 3D building
 * extrusion layer — both need re-applying after every `setStyle` call, since that wipes anything
 * not baked into the style JSON itself. */
function applyPaletteAndBuildings(map: maplibregl.Map, isDay: boolean) {
  const setFill = (id: string, color: string) => {
    if (map.getLayer(id)) map.setPaintProperty(id, 'fill-color', color);
  };
  const setLine = (id: string, color: string) => {
    if (map.getLayer(id)) map.setPaintProperty(id, 'line-color', color);
  };

  if (isDay) {
    const c = throwMapDayColor;
    setFill('water', c.water);
    setFill('park', c.park);
    setFill('landcover_grass', c.park);
    setFill('landcover_wood', c.park);
    setFill('building', c.building);
    map.setSky({
      'sky-color': '#e9f0f6',
      'sky-horizon-blend': 0.5,
      'horizon-color': '#dfe9f2',
      'horizon-fog-blend': 0.6,
      'fog-color': '#e6eef4',
      'fog-ground-blend': 0.7,
    });
  } else {
    const c = throwMapNightColor;
    map.setPaintProperty('background', 'background-color', c.land);
    setFill('water', c.water);
    setLine('waterway', c.water);
    setFill('building', c.landuseTint);
    ['landuse_residential', 'landcover_wood', 'landuse_park'].forEach((id) => setFill(id, c.landuseTint));
    setLine('highway_minor', c.roadMinor);
    setLine('highway_path', c.roadMinor);
    setLine('highway_major_inner', c.roadMajor);
    setLine('highway_major_subtle', c.roadMajor);
    setLine('highway_major_casing', c.roadCasing);
    setLine('highway_motorway_subtle', c.roadMajor);
    setLine('highway_motorway_casing', c.roadCasing);
  }

  if (!map.getLayer(BUILDINGS_LAYER_ID)) {
    const labelLayerId = map.getStyle().layers?.find((l) => l.type === 'symbol' && 'text-field' in (l.layout ?? {}))?.id;
    map.addLayer(
      {
        id: BUILDINGS_LAYER_ID,
        source: 'openmaptiles',
        'source-layer': 'building',
        type: 'fill-extrusion',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': isDay ? throwMapDayColor.building : throwMapNightColor.building,
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.95,
        },
      },
      labelLayerId,
    );
  } else {
    map.setPaintProperty(BUILDINGS_LAYER_ID, 'fill-extrusion-color', isDay ? throwMapDayColor.building : throwMapNightColor.building);
  }
}

function addOrUpdateRoute(map: maplibregl.Map, points: LatLng[] | undefined) {
  const coords = points && points.length >= 2 ? points.map((p): [number, number] => [p.longitude, p.latitude]) : null;
  const source = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
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
 * The real, interactive world map behind Throw — MapLibre GL JS (a WebGL vector-tile renderer)
 * over OpenFreeMap tiles, the same Throw-specific props surface as before: a handful of
 * city-level pins plus an optional animated flight route, no GPS accuracy ring or live-share
 * semantics. Pins and the flying plane stay our own React views, absolutely positioned over the
 * map canvas by projecting lat/lng to screen coordinates on every pan/zoom — same reasoning as
 * the previous Leaflet version (avatar/label rendering handled ourselves rather than by the map
 * library's own marker system). Two additions over the Leaflet version: real 3D building
 * extrusions, shown by default at the pitched-and-zoomed-in `FOCUS_ZOOM`/`FOCUS_PITCH` framing
 * below, and a day/night palette switch driven by the *destination's* local solar time (`focus`'s
 * longitude) rather than the viewer's own clock — replacing the map library was the only way to
 * get either, since flat raster tiles carry no building-height data and can't be recolored.
 */
export function ThrowMap({ pins, focus, fitPoints, route }: ThrowMapProps) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [, forceRender] = useState(0);

  // Whether the current target is the single-contact, pitched-and-zoomed-in framing (as opposed
  // to the flat, unpitched world default, or a multi-point `fitBounds`) — the sky-crop below only
  // makes sense here, since it's the only state with anything above the horizon to hide.
  const isPitchedFocus = !(fitPoints && fitPoints.length > 0) && !!focus;
  // How many pixels of the visible frame's own height to crop away — measured from the *outer*
  // (visible) box, not the (already-enlarged) map container, so it doesn't compound on itself.
  const [cropPx, setCropPx] = useState(0);

  // Which location's local time governs the day/night palette — the destination being viewed
  // (`focus`), falling back to whichever fit point comes first when only `fitPoints` is set, and
  // to "day" if there's nothing to go on yet (a briefly-wrong palette before location data
  // resolves reads better than defaulting to night).
  const daylightLng = focus?.longitude ?? fitPoints?.[0]?.longitude ?? null;
  const [isDay, setIsDay] = useState(() => (daylightLng === null ? true : isDaytimeAt(daylightLng)));
  const isDayRef = useRef(isDay);
  isDayRef.current = isDay;
  // What the map was actually constructed/last `setStyle`d with — lets the `[isDay]` effect
  // below skip a redundant reload when it fires on mount with the style the map already has.
  const styleAppliedRef = useRef<'day' | 'night'>(isDay ? 'day' : 'night');

  // Always holds whatever `focus`/`fitPoints` currently resolve to — mutated directly during
  // render (not in an effect) so it's never stale by the time a map event callback reads it.
  const targetRef = useRef<Target>(null);
  targetRef.current = fitPoints && fitPoints.length > 0 ? { kind: 'fit', points: fitPoints } : focus ? { kind: 'focus', point: focus } : null;

  const routePointsRef = useRef<LatLng[] | undefined>(undefined);
  routePointsRef.current = route?.points;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: throwMapStyleUrl[isDayRef.current ? 'day' : 'night'],
      center: WORLD_CENTER,
      zoom: WORLD_ZOOM,
      attributionControl: { compact: true },
      pitch: 0,
      maxPitch: 85,
    });
    const rerender = () => forceRender((n) => n + 1);
    map.on('move', rerender);
    map.on('zoom', rerender);
    map.on('style.load', () => {
      // Defensive, not just tidy: this runs against a style JSON this app doesn't own
      // (OpenFreeMap's), so a future upstream layer-id rename should degrade to "default
      // colors" rather than take the whole map down.
      try {
        applyPaletteAndBuildings(map, isDayRef.current);
        addOrUpdateRoute(map, routePointsRef.current);
      } catch (e) {
        console.error('[ThrowMap] failed to apply palette/buildings after style load:', e);
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

  // Tracks the visible frame's own height (the outer view, never enlarged by the crop below) so
  // `cropPx` stays correct across orientation changes/window resizes instead of being computed
  // once and going stale — and so it never feeds back into itself the way measuring the inner,
  // already-cropped container would.
  useEffect(() => {
    if (!outerRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0;
      setCropPx(Math.round(height * SKY_CROP_FRACTION));
    });
    observer.observe(outerRef.current);
    return () => observer.disconnect();
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

  // Recompute (and, if it actually flipped, re-style) the day/night palette whenever the
  // destination changes, and periodically thereafter so a long-open session still catches up.
  useEffect(() => {
    if (daylightLng === null) return;
    const recheck = () => setIsDay(isDaytimeAt(daylightLng));
    recheck();
    const id = setInterval(recheck, DAYTIME_RECHECK_MS);
    return () => clearInterval(id);
  }, [daylightLng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const wanted = isDay ? 'day' : 'night';
    // The map is already constructed with the right initial style (see `new maplibregl.Map`
    // above) — this effect still fires once on mount regardless (every effect does), and
    // without this guard that means an immediate, redundant `setStyle` call to the *same* URL
    // right as the real initial load is still in flight, interrupting and restarting it.
    if (styleAppliedRef.current === wanted) return;
    styleAppliedRef.current = wanted;
    // `setStyle` tears down and reloads every source/layer, including this component's own
    // route line and buildings layer — `style.load` (wired up at map creation) re-adds both, so
    // this is safe to call any time isDay flips, not just after the map itself is ready.
    map.setStyle(throwMapStyleUrl[wanted]);
  }, [isDay]);

  // The route line is a real MapLibre GeoJSON line layer (correct at every zoom without extra
  // math) — only the flying plane glyph itself needs to be a projected DOM overlay, same
  // reasoning as pins.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    addOrUpdateRoute(map, route?.points);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.points]);

  // `map.project` reports coordinates in the *canvas's* own frame — when the canvas has been
  // stretched upward to crop the sky, that frame no longer matches the visible one these pins and
  // the plane are actually positioned in, so their Y needs the same crop subtracted back out.
  const project = (lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return null;
    const point = map.project([lng, lat]);
    return { x: point.x, y: point.y - (isPitchedFocus ? cropPx : 0) };
  };

  const planePos = useMemo(() => (route ? latLngAtProgress(route.points, route.progress) : null), [route]);
  const planeScreen = route?.showPlane && planePos ? project(planePos.position.latitude, planePos.position.longitude) : null;
  const planeSize = route ? planeSizeForProgress(route.progress, PLANE_MAX_SIZE, PLANE_MIN_SIZE) : PLANE_MIN_SIZE;
  const planeOpacity = route ? planeOpacityForProgress(route.progress) : 1;

  return (
    <View ref={outerRef as unknown as React.Ref<View>} style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <div
        ref={containerRef}
        style={
          isPitchedFocus
            ? { position: 'absolute', left: 0, right: 0, top: -cropPx, height: `calc(100% + ${cropPx}px)` }
            : { position: 'absolute', inset: 0 }
        }
      />

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
