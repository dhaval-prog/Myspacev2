import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { throwColor } from '../../theme/throwTokens';
import { latLngAtProgress, planeOpacityForProgress, planeSizeForProgress } from '../../utils/mapProjection';
import { LocationPin } from './LocationPin';
import { PaperPlane } from './PaperPlane';
import type { ThrowMapProps } from './throwMapTypes';
import type { LatLng } from '../../utils/geo';

// The flying plane's size range — large right after launch, small on approach (see
// `planeSizeForProgress`).
const PLANE_MAX_SIZE = 44;
const PLANE_MIN_SIZE = 16;

// The map reads as a tilted 3D scene rather than a flat top-down sheet — the whole tile canvas
// plus its pin/plane overlays sit inside one CSS 3D transform, tipped back on the X axis with a
// real perspective vanishing point (not just a flat skew) so distance genuinely recedes into the
// screen, then scaled back up to re-cover the viewport the rotation pulls it out of. Camera
// position is entirely programmatic (`focus`/`fitPoints`/`route`, never user pan/zoom — see
// `L.map()` below), so there's no direct-manipulation gesture whose direction the tilt would
// throw off.
const TILT_PERSPECTIVE_PX = 1000;
const TILT_DEG = 55;
const TILT_SCALE = 1.7;

// A whole-world-ish default before there's anything to focus on.
const WORLD_CENTER: [number, number] = [15, 10];
const WORLD_ZOOM = 2;
// How far a single-point focus zooms in — city scale (Throw's location data is a city-level
// lat/lng, not live GPS, so this stays short of Live Locations' street-level 15). Zoom 6 was tried
// first and was wrong: at that zoom the viewport spans roughly 9° of longitude and 24° of
// latitude, so OSM's own tile labels are dominated by whichever *neighboring* cities happen to be
// biggest (Kota, Bhopal, Indore around Pune, say) while the actual focused city's name never
// renders at all — the pin's mathematical position was correct, but nothing on the map read as
// "this is Pune," which is what actually prompted the "can't see contact location" report.
const FOCUS_ZOOM = 11;

function pointsKey(points: { latitude: number; longitude: number }[] | null | undefined): string {
  return points ? points.map((p) => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`).join('|') : '';
}

type Target = { kind: 'fit'; points: LatLng[] } | { kind: 'focus'; point: LatLng } | null;

// Always an instant jump, never an animated pan/fly — both `flyTo` and an animated `setView`
// proved unreliable here: the selected contact can change twice in quick succession right after
// mount (self location and friend data from ThrowContext often resolve a render or two apart), and
// a second positioning call fired while the first's pan animation is still in flight interrupts
// it, leaving Leaflet's reported center stuck at whatever point the animation had reached —
// nowhere near either the old or the new target. An instant jump has no in-flight state to
// interrupt, so it's correct regardless of how close together these calls land.
function applyTarget(map: L.Map, target: Target) {
  if (!target) return;
  if (target.kind === 'fit') {
    map.fitBounds(L.latLngBounds(target.points.map((p) => [p.latitude, p.longitude])), { padding: [60, 60], animate: false });
  } else {
    map.setView([target.point.latitude, target.point.longitude], FOCUS_ZOOM, { animate: false });
  }
}

/**
 * The real world map behind Throw — raw Leaflet + OpenStreetMap tiles, the same stack as Live
 * Locations' MapCanvas.web.tsx, but with a Throw-specific props surface: a handful of city-level
 * pins plus an optional animated flight route, no GPS accuracy ring or live-share semantics.
 * Pins and the flying plane stay our own React views, absolutely positioned over the Leaflet
 * canvas by projecting lat/lng to screen coordinates on every pan/zoom — same reasoning as
 * MapCanvas.web.tsx (avatar rendering handled ourselves rather than by Leaflet's own
 * HTML-string-based marker/icon system). Presented as a tilted 3D scene (see `TILT_DEG` etc.
 * below) rather than a flat top-down sheet; camera position is entirely programmatic, so direct
 * user pan/zoom gestures are switched off rather than left to feel mismatched against the tilt.
 */
export function ThrowMap({ pins, focus, fitPoints, route }: ThrowMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const [, forceRender] = useState(0);

  // Always holds whatever `focus`/`fitPoints` currently resolve to — mutated directly during
  // render (not in an effect) so it's never stale by the time a Leaflet event callback reads it.
  const targetRef = useRef<Target>(null);
  targetRef.current = fitPoints && fitPoints.length > 0 ? { kind: 'fit', points: fitPoints } : focus ? { kind: 'focus', point: focus } : null;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // Every gesture handler that would let a user directly drag/scroll/pinch the camera is off —
    // camera position here is always driven by `focus`/`fitPoints`/`route` (see `applyTarget`),
    // never by the user, and a free-drag gesture would feel wrong against the tilted 3D scene
    // anyway (the finger moves in flat screen space; the tiles recede in perspective).
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
    }).setView(WORLD_CENTER, WORLD_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const rerender = () => forceRender((n) => n + 1);
    map.on('move', rerender);
    map.on('zoom', rerender);
    map.on('resize', rerender);
    mapRef.current = map;
    rerender();

    // Unlike Live Locations' MapCanvas (a full-screen absoluteFill, already correctly sized the
    // instant its container mounts), this map sits several `flex: 1` levels deep inside
    // ThrowHomeScreen/ThrowFlightScreen — React Native Web's flex layout can still be settling
    // the container's real pixel size well after this effect runs (and after the *first* resize
    // notification too — the container's size can change more than once before it truly settles),
    // so any positioning call issued too early converges on a geographically wrong center that
    // never self-corrects afterward on its own (only the tile viewport does, via
    // `invalidateSize()` — not wherever an earlier positioning call already decided to land).
    // Rather than guess which resize event is "the last one", every one of them re-applies
    // whatever the current target is — cheap, and idempotent once the size (and therefore the
    // projected target position) stops changing.
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
        applyTarget(map, targetRef.current);
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver?.disconnect();
      map.off('move', rerender);
      map.off('zoom', rerender);
      map.off('resize', rerender);
      map.remove();
      mapRef.current = null;
    };
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

  // The route line is a real Leaflet polyline (correct at every zoom without extra math) — only
  // the flying plane glyph itself needs to be a projected DOM overlay, same reasoning as pins.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !route || route.points.length < 2) {
      routeLineRef.current?.remove();
      routeLineRef.current = null;
      return;
    }
    const latlngs: [number, number][] = route.points.map((p) => [p.latitude, p.longitude]);
    if (!routeLineRef.current) {
      routeLineRef.current = L.polyline(latlngs, { color: throwColor.clay, weight: 2, opacity: 0.75, dashArray: '1, 7', lineCap: 'round' }).addTo(map);
    } else {
      routeLineRef.current.setLatLngs(latlngs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.points]);

  const project = (lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return null;
    const point = map.latLngToContainerPoint([lat, lng]);
    return { x: point.x, y: point.y };
  };

  const planePos = useMemo(() => (route ? latLngAtProgress(route.points, route.progress) : null), [route]);
  const planeScreen = route?.showPlane && planePos ? project(planePos.position.latitude, planePos.position.longitude) : null;
  const planeSize = route ? planeSizeForProgress(route.progress, PLANE_MAX_SIZE, PLANE_MIN_SIZE) : PLANE_MIN_SIZE;
  const planeOpacity = route ? planeOpacityForProgress(route.progress) : 1;

  return (
    <View style={StyleSheet.absoluteFill}>
      <div style={styles.tiltViewport}>
        <div style={styles.tiltScene}>
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
        </div>
      </div>
    </View>
  );
}

const styles: { tiltViewport: React.CSSProperties; tiltScene: React.CSSProperties } = {
  // The perspective vanishing point lives on this outer, untransformed layer — a CSS perspective
  // only produces real 3D depth for a transformed descendant, not for the element it's set on —
  // and this is also what clips the scaled-up scene back down to the map's own bounds.
  tiltViewport: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    perspective: `${TILT_PERSPECTIVE_PX}px`,
    perspectiveOrigin: '50% 20%',
  },
  // The tiles, pins and plane all live inside this one rotated layer, so they recede together as
  // a single sheet rather than each getting independently (and inconsistently) tilted. Rotating
  // back on X pulls the far (top) edge up out of view and the near (bottom) edge down past the
  // viewport's bottom edge; scaling back up from the bottom edge re-covers the box without
  // shifting where the near edge sits.
  tiltScene: {
    position: 'absolute',
    inset: 0,
    transform: `rotateX(${TILT_DEG}deg) scale(${TILT_SCALE})`,
    transformOrigin: '50% 100%',
    transformStyle: 'preserve-3d',
  },
};
