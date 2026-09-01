import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { colors, fontFamily } from '../../theme';
import { Icon } from '../Icon';
import { FriendAvatar } from '../friends/FriendAvatar';
import type { MapCanvasHandle, MapCanvasProps } from './mapTypes';

const CLOCK_ICON = 'M12 7v5l3.5 2M12 21a9 9 0 100-18 9 9 0 000 18z';

// Bangalore — a reasonable default center when neither the account nor any
// friend has a real position yet, rather than dropping the map at (0, 0).
const FALLBACK_CENTER: [number, number] = [12.9716, 77.5946];
const FALLBACK_ZOOM = 12;
const FOCUSED_ZOOM = 15;

/**
 * Real web map — Leaflet + OpenStreetMap tiles, no API key required. Friend
 * pins stay our own FriendAvatar-based React views, absolutely positioned
 * over the Leaflet canvas by projecting lat/lng to screen coordinates on
 * every pan/zoom, rather than handing avatar rendering to Leaflet's own
 * (HTML-string-based) marker/icon system.
 */
export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas({ pins, myPosition, amSharing, onSelectPin }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const hasFitRef = useRef(false);
  const [, forceRender] = useState(0);

  const located = pins.filter((p): p is typeof p & { latitude: number; longitude: number } => p.latitude !== null && p.longitude !== null);

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
    if (points.length === 1) {
      map.setView(points[0], FOCUSED_ZOOM, { animate: true });
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [60, 60], animate: true });
    }
  };

  // Auto-fit once, the first time we actually have something to show —
  // afterwards the user's own pan/zoom (or the recenter button) drives it.
  useEffect(() => {
    if (hasFitRef.current || !mapRef.current) return;
    if (located.length === 0 && !myPosition) return;
    hasFitRef.current = true;
    fitToPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located.length, myPosition]);

  useImperativeHandle(ref, () => ({ recenter: fitToPoints }));

  const project = (lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return null;
    const point = map.latLngToContainerPoint([lat, lng]);
    return { x: point.x, y: point.y };
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {located.map((p) => {
        const pos = project(p.latitude, p.longitude);
        if (!pos) return null;
        return (
          <Pressable
            key={p.userId}
            onPress={() => onSelectPin(p.userId)}
            style={[styles.pinWrap, { left: pos.x - 25, top: pos.y - 25 }]}
            accessibilityRole="button"
            accessibilityLabel={p.name}
          >
            <FriendAvatar userId={p.userId} name={p.name} size={50} />
            {p.live ? (
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
      })}

      {myPosition
        ? (() => {
            const pos = project(myPosition.latitude, myPosition.longitude);
            if (!pos) return null;
            return (
              <View style={[styles.pinWrap, { left: pos.x - 27, top: pos.y - 27 }]}>
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
            );
          })()
        : null}
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
});
