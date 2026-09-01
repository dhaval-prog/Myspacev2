import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import MapView, { Circle, Marker, Polyline, type Region } from 'react-native-maps';
import { colors, fontFamily } from '../../theme';
import { Icon } from '../Icon';
import { FriendAvatar } from '../friends/FriendAvatar';
import { PulseRing } from './PulseRing';
import { clusterPins, type PinCluster } from '../../utils/clusterPins';
import type { MapCanvasHandle, MapCanvasProps, MapPin } from './mapTypes';

const CLOCK_ICON = 'M12 7v5l3.5 2M12 21a9 9 0 100-18 9 9 0 000 18z';

// Bangalore — a reasonable default center when neither the account nor any
// friend has a real position yet, rather than dropping the map at (0, 0).
const FALLBACK_REGION: Region = { latitude: 12.9716, longitude: 77.5946, latitudeDelta: 0.05, longitudeDelta: 0.05 };
const DELTA = { latitudeDelta: 0.02, longitudeDelta: 0.02 };
const CLUSTER_THRESHOLD_PX = 46;

// Google's well-known "Silver" style — muted grays instead of the default
// bright road/POI palette, closer in spirit to the web canvas's CARTO
// tiles. Only takes effect on Android (Google Maps); iOS stays on Apple
// Maps, which react-native-maps can't restyle without switching provider.
const ANDROID_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
];

type LocatedPin = MapPin & { latitude: number; longitude: number };
type ProjectedPin = { id: string; x: number; y: number; pin: LocatedPin };

/** The real map — Apple Maps on iOS out of the box, Google Maps on Android once a Maps API key is added to app.json. */
export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(
  { pins, myPosition, amSharing, myAccuracy, routeCoords, bottomInset = 0, onSelectPin },
  ref
) {
  const mapRef = useRef<MapView>(null);
  const hasFitRef = useRef(false);
  const located = pins.filter((p): p is LocatedPin => p.latitude !== null && p.longitude !== null);

  const initialRegion = myPosition
    ? { ...myPosition, ...DELTA }
    : located[0]
      ? { latitude: located[0].latitude, longitude: located[0].longitude, ...DELTA }
      : FALLBACK_REGION;

  // Approximate viewport, used only to decide which pins are close enough
  // on-screen to cluster — actual pin rendering stays exact (native
  // <Marker coordinate>), this never drives what's drawn where.
  const [region, setRegion] = useState<Region>(initialRegion);
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const fitToPoints = () => {
    const points = located.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
    if (myPosition) points.push(myPosition);
    if (points.length === 0) return;
    if (points.length === 1) {
      // A fixed region always centers geographically on screen — with the
      // opaque "Nearby friends" sheet docked at the bottom, that usually
      // puts the pin right behind it. Nudge the region's center south so
      // the point renders in the upper, unobstructed portion instead —
      // only possible once layout.height is known, so this degrades to a
      // plain center on the very first fit if that hasn't measured yet.
      const target = points[0];
      const centerLat = layout.height > 0 ? target.latitude - (bottomInset / 2 / layout.height) * DELTA.latitudeDelta : target.latitude;
      mapRef.current?.animateToRegion({ latitude: centerLat, longitude: target.longitude, ...DELTA }, 350);
    } else {
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 80, right: 80, bottom: 80 + bottomInset, left: 80 },
        animated: true,
      });
    }
  };

  useImperativeHandle(ref, () => ({ recenter: fitToPoints }));

  // Auto-fit once, the first time we actually have something to show — the
  // map otherwise stays put wherever `initialRegion` first landed (usually
  // before location permission resolves), leaving the "You" pin off-screen.
  useEffect(() => {
    if (hasFitRef.current) return;
    if (located.length === 0 && !myPosition) return;
    hasFitRef.current = true;
    fitToPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located.length, myPosition, bottomInset]);

  // Auto-fit to the straight-line route whenever it's set (or cleared and
  // re-set to a new friend) — same reasoning as the initial auto-fit above.
  useEffect(() => {
    if (!routeCoords || routeCoords.length < 2) return;
    mapRef.current?.fitToCoordinates(routeCoords, {
      edgePadding: { top: 80, right: 80, bottom: 80 + bottomInset, left: 80 },
      animated: true,
    });
  }, [routeCoords, bottomInset]);

  const onLayout = (e: LayoutChangeEvent) => {
    setLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
  };

  const projectApprox = (lat: number, lng: number) => {
    if (!layout.width || !layout.height || !region.longitudeDelta || !region.latitudeDelta) return null;
    const x = ((lng - region.longitude) / region.longitudeDelta + 0.5) * layout.width;
    const y = ((region.latitude - lat) / region.latitudeDelta + 0.5) * layout.height;
    return { x, y };
  };

  // Before layout/region are known there's nothing to project pins onto —
  // skip clustering rather than have every pin collapse to the same point.
  const canCluster = layout.width > 0 && layout.height > 0;
  const projected: ProjectedPin[] = located.map((p) => {
    const pos = canCluster ? projectApprox(p.latitude, p.longitude) : null;
    return { id: p.userId, x: pos?.x ?? 0, y: pos?.y ?? 0, pin: p };
  });

  const clusters: PinCluster<ProjectedPin>[] = canCluster
    ? clusterPins(projected, CLUSTER_THRESHOLD_PX)
    : projected.map((p) => ({ points: [p], x: p.x, y: p.y }));

  const zoomToCluster = (cluster: PinCluster<ProjectedPin>) => {
    const lat = cluster.points.reduce((sum, p) => sum + p.pin.latitude, 0) / cluster.points.length;
    const lng = cluster.points.reduce((sum, p) => sum + p.pin.longitude, 0) / cluster.points.length;
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: Math.max(region.latitudeDelta / 4, 0.003), longitudeDelta: Math.max(region.longitudeDelta / 4, 0.003) },
      350
    );
  };

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      onRegionChangeComplete={setRegion}
      onLayout={onLayout}
      showsUserLocation={!!myPosition}
      showsMyLocationButton={false}
      customMapStyle={Platform.OS === 'android' ? ANDROID_MAP_STYLE : undefined}
    >
      {/*
        tracksViewChanges is true on every Marker below — false skips
        re-snapshotting a custom marker view after its first render, but on
        a real device that first snapshot can land before the view has
        actually laid out (fonts, layout pass), leaving a permanently blank
        pin. True costs a bit more on every re-render, cheap at the handful
        of pins this screen ever shows, and it's what actually renders
        reliably.
      */}
      {clusters.map((cluster) => {
        if (cluster.points.length === 1) {
          const { pin } = cluster.points[0];
          return (
            <Marker key={pin.userId} coordinate={{ latitude: pin.latitude, longitude: pin.longitude }} onPress={() => onSelectPin(pin.userId)} zIndex={1} tracksViewChanges={true}>
              <View style={styles.pinWrap}>
                {pin.live ? <PulseRing avatarSize={44} /> : null}
                <FriendAvatar userId={pin.userId} name={pin.name} size={44} />
                {pin.live ? (
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveBadgeText}>LIVE</Text>
                  </View>
                ) : (
                  <View style={styles.lastSeenBadge}>
                    <Icon path={CLOCK_ICON} color={colors.lime} size={9} strokeWidth={2.4} />
                  </View>
                )}
              </View>
            </Marker>
          );
        }
        const lat = cluster.points.reduce((sum, p) => sum + p.pin.latitude, 0) / cluster.points.length;
        const lng = cluster.points.reduce((sum, p) => sum + p.pin.longitude, 0) / cluster.points.length;
        return (
          <Marker
            key={`cluster-${cluster.points.map((p) => p.id).join('-')}`}
            coordinate={{ latitude: lat, longitude: lng }}
            onPress={() => zoomToCluster(cluster)}
            zIndex={1}
            tracksViewChanges={true}
          >
            <View style={styles.pinWrap}>
              <View style={styles.clusterBadge}>
                <Text style={styles.clusterCount}>{cluster.points.length}</Text>
              </View>
            </View>
          </Marker>
        );
      })}

      {routeCoords && routeCoords.length >= 2 ? (
        // A straight "as the crow flies" dashed line — not a real
        // turn-by-turn route, this app has no directions API/key.
        <Polyline coordinates={routeCoords} strokeColor={colors.ink} strokeWidth={3} lineDashPattern={[2, 10]} lineCap="round" />
      ) : null}

      {myPosition && myAccuracy ? (
        <Circle
          center={myPosition}
          radius={myAccuracy}
          strokeColor="rgba(22,33,12,0.3)"
          strokeWidth={1}
          fillColor="rgba(22,33,12,0.08)"
        />
      ) : null}

      {myPosition ? (
        // No zIndex here (a negative one previously made this marker
        // disappear on iOS — it renders behind the map's own tile layer
        // rather than just behind other markers). Friend markers above are
        // bumped to zIndex 1 instead, which is enough to win any tap
        // conflict when this one sits right on top of a friend's pin —
        // this one has no onPress of its own anyway.
        <Marker coordinate={myPosition} tracksViewChanges={true}>
          <View style={styles.pinWrap}>
            {amSharing ? <PulseRing avatarSize={48} /> : null}
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
                <Icon path={CLOCK_ICON} color={colors.lime} size={9} strokeWidth={2.4} />
              </View>
            )}
          </View>
        </Marker>
      ) : null}
    </MapView>
  );
});

const styles = StyleSheet.create({
  pinWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.coral,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveBadgeText: {
    fontFamily: fontFamily.mono500,
    fontSize: 8,
    letterSpacing: 0.4,
    color: '#fff',
  },
  lastSeenBadge: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youTile: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youTileText: {
    fontFamily: fontFamily.sans700,
    fontSize: 12.5,
    color: colors.lime,
  },
  clusterBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterCount: {
    fontFamily: fontFamily.sans700,
    fontSize: 16,
    color: colors.lime,
  },
});
