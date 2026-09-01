import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { colors, fontFamily } from '../../theme';
import { Icon } from '../Icon';
import { FriendAvatar } from '../friends/FriendAvatar';
import { PulseRing } from './PulseRing';
import { clusterPins, type PinCluster } from '../../utils/clusterPins';
import type { MapCanvasHandle, MapCanvasProps, MapPin } from './mapTypes';

const CLOCK_ICON = 'M12 7v5l3.5 2M12 21a9 9 0 100-18 9 9 0 000 18z';

// Bangalore — a reasonable default center when neither the account nor any
// friend has a real position yet, rather than dropping the map at (0, 0).
const FALLBACK_CENTER: [number, number] = [12.9716, 77.5946];
const FALLBACK_ZOOM = 12;
const FOCUSED_ZOOM = 15;

// Pins within this many screen pixels of each other collapse into one
// cluster badge — cheap to recompute every render since it only ever runs
// over a handful of friends.
const CLUSTER_THRESHOLD_PX = 46;

type LocatedPin = MapPin & { latitude: number; longitude: number };
type ProjectedPin = { id: string; x: number; y: number; pin: LocatedPin };

/**
 * Real web map — Leaflet + OpenStreetMap tiles, no API key required.
 * (CARTO's Positron basemap was tried as a more muted, branded look, but
 * its free anonymous tile endpoint turned out to require a key — it just
 * serves an "API KEY REQUIRED" watermark tile without one. Back to plain
 * OSM raster tiles until that's set up properly, if ever.) Friend pins
 * stay our own FriendAvatar-based React views, absolutely positioned over
 * the Leaflet canvas by projecting lat/lng to screen coordinates on every
 * pan/zoom, rather than handing avatar rendering to Leaflet's own
 * (HTML-string-based) marker/icon system.
 */
export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(
  { pins, myPosition, amSharing, myAccuracy, routeCoords, bottomInset = 0, onSelectPin },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const hasFitRef = useRef(false);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const [, forceRender] = useState(0);

  const located = pins.filter((p): p is LocatedPin => p.latitude !== null && p.longitude !== null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView(FALLBACK_CENTER, FALLBACK_ZOOM);
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

  const fitToPoints = () => {
    const map = mapRef.current;
    if (!map) return;
    const points: [number, number][] = located.map((p) => [p.latitude, p.longitude]);
    if (myPosition) points.push([myPosition.latitude, myPosition.longitude]);
    if (points.length === 0) return;
    // fitBounds (rather than setView) even for a single point — a
    // zero-size bounds still respects maxZoom for the zoom level, but
    // crucially also respects asymmetric padding, which setView has no
    // equivalent for. Without it, the center point lands geographically in
    // the middle of the whole screen, which is usually right behind the
    // opaque "Nearby friends" sheet docked at the bottom.
    map.fitBounds(L.latLngBounds(points), {
      paddingTopLeft: [60, 60],
      paddingBottomRight: [60, 60 + bottomInset],
      maxZoom: FOCUSED_ZOOM,
      animate: true,
    });
  };

  // Auto-fit once, the first time we actually have something to show —
  // afterwards the user's own pan/zoom (or the recenter button) drives it.
  useEffect(() => {
    if (hasFitRef.current || !mapRef.current) return;
    if (located.length === 0 && !myPosition) return;
    hasFitRef.current = true;
    fitToPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located.length, myPosition, bottomInset]);

  useImperativeHandle(ref, () => ({ recenter: fitToPoints }));

  // A soft ring showing GPS accuracy around "You" — real-world meters, so
  // Leaflet's own circle (not a screen-projected view) draws it correctly
  // at every zoom level without extra math.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !myPosition || !myAccuracy) {
      accuracyCircleRef.current?.remove();
      accuracyCircleRef.current = null;
      return;
    }
    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = L.circle([myPosition.latitude, myPosition.longitude], {
        radius: myAccuracy,
        color: colors.ink,
        weight: 1,
        opacity: 0.25,
        fillColor: colors.ink,
        fillOpacity: 0.07,
        interactive: false,
      }).addTo(map);
    } else {
      accuracyCircleRef.current.setLatLng([myPosition.latitude, myPosition.longitude]);
      accuracyCircleRef.current.setRadius(myAccuracy);
    }
  }, [myPosition, myAccuracy]);

  // A straight "as the crow flies" dashed line — not a real turn-by-turn
  // route, this app has no directions API/key — auto-fit to it whenever it
  // changes so both ends are actually visible.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !routeCoords || routeCoords.length < 2) {
      routeLineRef.current?.remove();
      routeLineRef.current = null;
      return;
    }
    const latlngs: [number, number][] = routeCoords.map((p) => [p.latitude, p.longitude]);
    if (!routeLineRef.current) {
      routeLineRef.current = L.polyline(latlngs, { color: colors.ink, weight: 3, opacity: 0.75, dashArray: '2, 10', lineCap: 'round' }).addTo(map);
    } else {
      routeLineRef.current.setLatLngs(latlngs);
    }
    map.fitBounds(L.latLngBounds(latlngs), {
      paddingTopLeft: [70, 70],
      paddingBottomRight: [70, 70 + bottomInset],
      animate: true,
    });
  }, [routeCoords, bottomInset]);

  const project = (lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return null;
    const point = map.latLngToContainerPoint([lat, lng]);
    return { x: point.x, y: point.y };
  };

  const projected: ProjectedPin[] = located
    .map((p) => {
      const pos = project(p.latitude, p.longitude);
      return pos ? { id: p.userId, x: pos.x, y: pos.y, pin: p } : null;
    })
    .filter((v): v is ProjectedPin => v !== null);

  const clusters = clusterPins(projected, CLUSTER_THRESHOLD_PX);

  const zoomToCluster = (cluster: PinCluster<ProjectedPin>) => {
    const map = mapRef.current;
    if (!map) return;
    const lat = cluster.points.reduce((sum, p) => sum + p.pin.latitude, 0) / cluster.points.length;
    const lng = cluster.points.reduce((sum, p) => sum + p.pin.longitude, 0) / cluster.points.length;
    map.setView([lat, lng], Math.min(19, map.getZoom() + 3), { animate: true });
  };

  const myPos = myPosition ? project(myPosition.latitude, myPosition.longitude) : null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {clusters.map((cluster) => {
        if (cluster.points.length === 1) {
          const { pin, x, y } = cluster.points[0];
          return (
            <Pressable
              key={pin.userId}
              onPress={() => onSelectPin(pin.userId)}
              style={[styles.pinWrap, { left: x - 25, top: y - 25 }]}
              accessibilityRole="button"
              accessibilityLabel={pin.name}
            >
              {pin.live ? <PulseRing avatarSize={50} /> : null}
              <FriendAvatar userId={pin.userId} name={pin.name} size={50} />
              {pin.live ? (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
              ) : (
                <View style={styles.lastSeenBadge}>
                  <Icon path={CLOCK_ICON} color={colors.lime} size={10} strokeWidth={2.4} />
                </View>
              )}
            </Pressable>
          );
        }
        return (
          <Pressable
            key={`cluster-${cluster.points.map((p) => p.id).join('-')}`}
            onPress={() => zoomToCluster(cluster)}
            style={[styles.pinWrap, { left: cluster.x - 27, top: cluster.y - 27 }]}
            accessibilityRole="button"
            accessibilityLabel={`${cluster.points.length} friends here — zoom in`}
          >
            <View style={styles.clusterBadge}>
              <Text style={styles.clusterCount}>{cluster.points.length}</Text>
            </View>
          </Pressable>
        );
      })}

      {myPosition && myPos ? (
        // pointerEvents="none" — this is a plain non-interactive marker, but
        // being the topmost absolutely-positioned view in DOM order it would
        // otherwise swallow taps on any friend pin/cluster it happens to
        // overlap (e.g. standing right next to someone).
        <View pointerEvents="none" style={[styles.pinWrap, { left: myPos.x - 27, top: myPos.y - 27 }]}>
          {amSharing ? <PulseRing avatarSize={54} /> : null}
          <View style={styles.youTile}>
            <Text style={styles.youTileText}>You</Text>
          </View>
          {amSharing ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          ) : (
            <View style={styles.lastSeenBadge}>
              <Icon path={CLOCK_ICON} color={colors.lime} size={10} strokeWidth={2.4} />
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  pinWrap: {
    position: 'absolute',
  },
  liveBadge: {
    position: 'absolute',
    top: -8,
    right: -10,
    backgroundColor: colors.coral,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    shadowColor: colors.ink,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 2,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveBadgeText: {
    fontFamily: fontFamily.mono500,
    fontSize: 8.5,
    letterSpacing: 0.4,
    color: '#fff',
  },
  lastSeenBadge: {
    position: 'absolute',
    bottom: -3,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youTile: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youTileText: {
    fontFamily: fontFamily.sans700,
    fontSize: 14,
    color: colors.lime,
  },
  clusterBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  clusterCount: {
    fontFamily: fontFamily.sans700,
    fontSize: 18,
    color: colors.lime,
  },
});
