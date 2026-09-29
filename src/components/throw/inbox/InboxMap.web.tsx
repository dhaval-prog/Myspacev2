import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { inboxColor, inboxLayout } from '../../../theme/throwInboxTokens';
import type { InboxMapProps } from './inboxMapTypes';
import type { LatLng } from '../../../utils/geo';

mapboxgl.accessToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const MAPBOX_STYLE_URL = process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? 'mapbox://styles/mapbox/standard';

// A fixed framing rather than a fit-to-bounds camera — same "always the same K" spirit as the
// design handoff's own constant-scale synthetic projection, just real map units. Flatter/less
// pitched than the main Throw map (ThrowMap.*'s own ~76°): this screen layers a letter card, an
// avatar rail and a chip row on top, where a heavy pitch would read as busy/disorienting under
// all that chrome, and legibility of "where did this letter come from" matters more here than
// the main map's landing-page immersiveness.
const ZOOM = 9;
const PITCH = 45;
const BEARING = 0;
const PAN_MS = 1100;
const PAN_EASING = Easing.bezier(0.3, 0.8, 0.2, 1);

const ROUTE_SOURCE_ID = 'inbox-letters-route';
const ROUTE_LAYER_ID = 'inbox-letters-route-line';

function applyLightPreset(map: mapboxgl.Map, isDay: boolean) {
  map.setConfigProperty('basemap', 'lightPreset', isDay ? 'day' : 'night');
}

function disableStyleTransitions(map: mapboxgl.Map) {
  (map as unknown as { style?: { setTransition?: (t: { duration: number; delay: number }) => void } }).style?.setTransition?.({
    duration: 0,
    delay: 0,
  });
}

function addOrUpdateRoute(map: mapboxgl.Map, points: LatLng[]) {
  const coords = points.length >= 2 ? points.map((p): [number, number] => [p.longitude, p.latitude]) : null;
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
      paint: { 'line-color': 'rgba(17,17,17,.28)', 'line-width': 2.5, 'line-dasharray': [1, 4] },
    });
  }
}

/** A looping ring behind the active pin — CSS `pinPulse` keyframe ported to Animated (0%: scale
 * .8/opacity .7 → 100%: scale 2.4/opacity 0, 1.6s ease-out, infinite). */
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

function keyOf(p: LatLng | null): string {
  return p ? `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}` : '';
}

/**
 * Web map for the Received Letters screen — real Mapbox tiles (per explicit request, replacing
 * the design handoff's own CSS map pattern), same style/token as the main Throw map. The camera
 * doesn't center the active letter's location at the viewport's true center: `padding` reserves
 * space along the bottom so the unpadded area's own center — where `center` actually renders —
 * lands at `inboxLayout.mapAnchor` (195,228 in the 390×844 reference frame, i.e. noticeably above
 * true center, leaving room for the letter card below it) — same padding-based off-center-anchor
 * technique ThrowMap.web.tsx already uses for its own focus camera, just solved for a specific
 * fractional screen position instead of "a bit above center".
 */
export function InboxMap({ pins, route, anchor, isDay }: InboxMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [, forceRender] = useState(0);
  const isDayRef = useRef(isDay);
  isDayRef.current = isDay;
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  const routeRef = useRef(route);
  routeRef.current = route;

  const anchorKey = keyOf(anchor);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLE_URL,
      center: anchor ? [anchor.longitude, anchor.latitude] : [0, 20],
      zoom: ZOOM,
      pitch: PITCH,
      bearing: BEARING,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    const rerender = () => forceRender((n) => n + 1);
    map.on('move', rerender);
    map.on('zoom', rerender);
    map.on('style.load', () => {
      try {
        disableStyleTransitions(map);
        applyLightPreset(map, isDayRef.current);
        addOrUpdateRoute(map, routeRef.current);
      } catch (e) {
        console.error('[InboxMap] failed to apply light preset/route after style load:', e);
      }
      rerender();
    });
    mapRef.current = map;

    // Bottom padding depends on the container's real pixel height (see applyAnchor below) — RN
    // Web's flex layout can still be settling this well after mount, same reasoning as
    // ThrowMap.web's own resize handling. Every resize re-applies the current anchor instantly
    // (no animation replay on layout settling, only on a real anchor change — see the effect
    // below).
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.resize();
        const a = anchorRef.current;
        if (!a) return;
        const h = containerRef.current?.getBoundingClientRect().height || inboxLayout.phone.height;
        const bottom = Math.max(0, h * (1 - (2 * inboxLayout.mapAnchor.y) / inboxLayout.phone.height));
        map.jumpTo({ center: [a.longitude, a.latitude], zoom: ZOOM, pitch: PITCH, bearing: BEARING, padding: { top: 0, bottom, left: 0, right: 0 } });
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

  // The actual animated pan — 1100ms cubic-bezier(.3,.8,.2,1), per the handoff's own README.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !anchor) return;
    const h = containerRef.current?.getBoundingClientRect().height || inboxLayout.phone.height;
    const bottom = Math.max(0, h * (1 - (2 * inboxLayout.mapAnchor.y) / inboxLayout.phone.height));
    map.easeTo({
      center: [anchor.longitude, anchor.latitude],
      zoom: ZOOM,
      pitch: PITCH,
      bearing: BEARING,
      padding: { top: 0, bottom, left: 0, right: 0 },
      duration: PAN_MS,
      easing: PAN_EASING,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    addOrUpdateRoute(map, route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    applyLightPreset(map, isDay);
  }, [isDay]);

  const project = (lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return null;
    const point = map.project([lng, lat]);
    return { x: point.x, y: point.y };
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {pins.map((pin) => {
        const pos = project(pin.latitude, pin.longitude);
        if (!pos) return null;
        const size = pin.active ? 24 : 14;
        return (
          <View key={pin.id} pointerEvents="none" style={[styles.pinWrap, { left: pos.x, top: pos.y, zIndex: pin.active ? 10 : 1 }]}>
            {pin.active && <PulsingRing />}
            <View style={[styles.pinDot, { width: size, height: size, borderRadius: size / 2, backgroundColor: pin.active ? inboxColor.accentBlue : inboxColor.ink, marginLeft: -size / 2, marginTop: -size / 2 }]} />
            {pin.active && pin.label && (
              <View style={styles.pinLabelWrap}>
                <Animated.Text style={styles.pinLabel}>{pin.label}</Animated.Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pinWrap: { position: 'absolute', width: 0, height: 0 },
  pulseRing: { position: 'absolute', left: -18, top: -18, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(47,107,255,.35)' },
  pinDot: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
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
