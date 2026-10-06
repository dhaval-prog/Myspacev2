import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { fmColor } from '../../../theme/friendsMapTokens';
import type { FriendsMapCanvasProps } from './friendsMapCanvasTypes';

mapboxgl.accessToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
// A flat, muted street style (unlike ThrowMap's pitched "Standard" style) — this screen is a
// straight-down 2D map, no 3D buildings/day-night config to drive.
const MAPBOX_STYLE_URL = process.env.EXPO_PUBLIC_MAPBOX_FRIENDS_MAP_STYLE_URL ?? 'mapbox://styles/mapbox/light-v11';

// Design handoff's own starting camera — zoom 4 (256px-tile convention) centered on India.
const DEFAULT_CENTER: [number, number] = [79.5, 21.5]; // Mapbox wants [lng, lat]
const DEFAULT_ZOOM_256 = 4;

// Mapbox's own tiles are 512px, one convention "more zoomed in" per step than the 256px-tile
// convention friendsMapMath.ts uses (OSM/the design handoff's own tile math) — the same world
// pixel width needs one fewer Mapbox zoom step, so converting one way subtracts 1 and the other
// way adds 1. This is the one place that conversion happens; everything else in this feature
// (clustering, fit, focus) stays in the 256px convention.
const toMapboxZoom = (z256: number) => z256 - 1;
const toZoom256 = (mapboxZoom: number) => mapboxZoom + 1;

function pointsKey(points: { latitude: number; longitude: number }[]): string {
  return points.map((p) => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`).join('|');
}

/**
 * The Friends Map's real, draggable/zoomable world map — Mapbox GL JS, gestures left on (unlike
 * ThrowMap this is a flat 2D map, so rotate/pitch are disabled rather than driven). Pins are our
 * own absolutely-positioned views (not Mapbox markers), projected via `map.project()` and
 * re-positioned on every 'move'/'zoom' — same proven pattern as `ThrowMap.web.tsx`. Unlike
 * ThrowMap, this canvas also *reports* its camera back out via `onCameraChange` (clustering and
 * the sheet/controls layout both need to know the live zoom/center, not just render pins at it).
 */
export function FriendsMapCanvas({ me, pins, renderPin, renderMe, cameraCommand, onCameraChange }: FriendsMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const onCameraChangeRef = useRef(onCameraChange);
  onCameraChangeRef.current = onCameraChange;
  const [, forceRender] = useState(0);
  const [ready, setReady] = useState(false);
  const lastCommandTokenRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: toMapboxZoom(DEFAULT_ZOOM_256),
      attributionControl: false,
      dragRotate: false,
      touchPitch: false,
      pitchWithRotate: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    map.touchZoomRotate.disableRotation();

    const report = () => {
      const c = map.getCenter();
      onCameraChangeRef.current({ zoom: toZoom256(map.getZoom()), center: { latitude: c.lat, longitude: c.lng } });
    };
    const rerender = () => {
      forceRender((n) => n + 1);
      report();
    };
    map.on('move', rerender);
    map.on('zoom', rerender);
    map.once('idle', () => setReady(true));
    map.on('load', rerender);
    mapRef.current = map;

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.resize();
        rerender();
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

  // Applies an imperative jump/fit whenever `cameraCommand.token` actually changes — never a
  // re-apply of the same command, and never animated (an in-flight animated pan interrupted by a
  // second command right behind it is the same bug ThrowMap's own `applyTarget` comment
  // documents; an instant jump sidesteps it here too).
  const fitKey = cameraCommand?.kind === 'fit' ? pointsKey(cameraCommand.points) : '';
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cameraCommand || cameraCommand.token === lastCommandTokenRef.current) return;
    lastCommandTokenRef.current = cameraCommand.token;
    if (cameraCommand.kind === 'jump') {
      map.jumpTo({ center: [cameraCommand.center.longitude, cameraCommand.center.latitude], zoom: toMapboxZoom(cameraCommand.zoom) });
    } else {
      const lngs = cameraCommand.points.map((p) => p.longitude);
      const lats = cameraCommand.points.map((p) => p.latitude);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 60, duration: 0 },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraCommand?.token, cameraCommand?.kind, fitKey]);

  const project = (lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return null;
    const p = map.project([lng, lat]);
    return { x: p.x, y: p.y };
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: ready ? 1 : 0,
          transition: 'opacity 240ms ease-out',
          filter: 'grayscale(1) brightness(1.1) contrast(.85)',
        }}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: fmColor.mapTileTint, opacity: 0.38, mixBlendMode: 'multiply' } as object]} />

      {me &&
        (() => {
          const pos = project(me.latitude, me.longitude);
          if (!pos) return null;
          return (
            <View pointerEvents="none" style={{ position: 'absolute', left: pos.x, top: pos.y, zIndex: 1 }}>
              {renderMe ? renderMe() : null}
            </View>
          );
        })()}

      {pins.map((pin) => {
        const pos = project(pin.latitude, pin.longitude);
        if (!pos) return null;
        return (
          <View key={pin.id} style={{ position: 'absolute', left: pos.x, top: pos.y, zIndex: pin.zIndex }}>
            {renderPin(pin)}
          </View>
        );
      })}
    </View>
  );
}
