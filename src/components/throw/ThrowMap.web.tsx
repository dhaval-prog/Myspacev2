import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { throwColor } from '../../theme/throwTokens';
import { latLngAtProgress } from '../../utils/mapProjection';
import { LocationPin } from './LocationPin';
import { PaperPlane } from './PaperPlane';
import type { ThrowMapProps } from './throwMapTypes';

// A whole-world-ish default before there's anything to focus on.
const WORLD_CENTER: [number, number] = [15, 10];
const WORLD_ZOOM = 2;
// How far a single-point focus zooms in — regional/multi-city scale (Throw's location data is a
// city-level lat/lng, not live GPS, so this stays well short of Live Locations' street-level 15).
const FOCUS_ZOOM = 6;

function pointsKey(points: { latitude: number; longitude: number }[] | null | undefined): string {
  return points ? points.map((p) => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`).join('|') : '';
}

/**
 * The real, interactive world map behind Throw — raw Leaflet + OpenStreetMap tiles, the same
 * stack as Live Locations' MapCanvas.web.tsx, but with a Throw-specific props surface: a handful
 * of city-level pins plus an optional animated flight route, no GPS accuracy ring or live-share
 * semantics. Pins and the flying plane stay our own React views, absolutely positioned over the
 * Leaflet canvas by projecting lat/lng to screen coordinates on every pan/zoom — same reasoning
 * as MapCanvas.web.tsx (avatar rendering handled ourselves rather than by Leaflet's own
 * HTML-string-based marker/icon system).
 */
export function ThrowMap({ pins, focus, fitPoints, route }: ThrowMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView(WORLD_CENTER, WORLD_ZOOM);
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
    return () => {
      map.off('move', rerender);
      map.off('zoom', rerender);
      map.off('resize', rerender);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const fitKey = pointsKey(fitPoints);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitPoints || fitPoints.length === 0) return;
    map.fitBounds(
      L.latLngBounds(fitPoints.map((p) => [p.latitude, p.longitude])),
      { padding: [60, 60], animate: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  const focusKey = focus ? `${focus.latitude.toFixed(3)},${focus.longitude.toFixed(3)}` : '';
  useEffect(() => {
    const map = mapRef.current;
    if (!map || (fitPoints && fitPoints.length > 0) || !focus) return;
    map.flyTo([focus.latitude, focus.longitude], FOCUS_ZOOM, { animate: true });
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
          />
        );
      })}

      {planeScreen && planePos && (
        <View pointerEvents="none" style={{ position: 'absolute', left: planeScreen.x - 13, top: planeScreen.y - 13, transform: [{ rotate: `${planePos.bearingDeg}deg` }] }}>
          <PaperPlane size={26} color={throwColor.clayDeep} />
        </View>
      )}
    </View>
  );
}
