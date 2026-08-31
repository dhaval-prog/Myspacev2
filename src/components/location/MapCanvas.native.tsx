import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { colors, fontFamily } from '../../theme';
import { Icon } from '../Icon';
import { FriendAvatar } from '../friends/FriendAvatar';
import type { MapCanvasHandle, MapCanvasProps } from './mapTypes';

const CLOCK_ICON = 'M12 7v5l3.5 2M12 21a9 9 0 100-18 9 9 0 000 18z';

// Bangalore — a reasonable default center when neither the account nor any
// friend has a real position yet, rather than dropping the map at (0, 0).
const FALLBACK_REGION = { latitude: 12.9716, longitude: 77.5946, latitudeDelta: 0.05, longitudeDelta: 0.05 };
const DELTA = { latitudeDelta: 0.02, longitudeDelta: 0.02 };

/** The real map — Apple Maps on iOS out of the box, Google Maps on Android once a Maps API key is added to app.json. */
export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas({ pins, myPosition, amSharing, onSelectPin }, ref) {
  const mapRef = useRef<MapView>(null);
  const located = pins.filter((p): p is typeof p & { latitude: number; longitude: number } => p.latitude !== null && p.longitude !== null);

  useImperativeHandle(ref, () => ({
    recenter: () => {
      const target = myPosition ?? (located[0] ? { latitude: located[0].latitude, longitude: located[0].longitude } : null);
      if (target) mapRef.current?.animateToRegion({ ...target, ...DELTA }, 350);
    },
  }));

  const initialRegion = myPosition
    ? { ...myPosition, ...DELTA }
    : located[0]
      ? { latitude: located[0].latitude, longitude: located[0].longitude, ...DELTA }
      : FALLBACK_REGION;

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      showsUserLocation={!!myPosition}
      showsMyLocationButton={false}
    >
      {located.map((p) => (
        <Marker key={p.userId} coordinate={{ latitude: p.latitude, longitude: p.longitude }} onPress={() => onSelectPin(p.userId)} tracksViewChanges={false}>
          <View style={styles.pinWrap}>
            <FriendAvatar userId={p.userId} name={p.name} size={44} />
            {p.live ? (
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
      ))}

      {amSharing && myPosition ? (
        <Marker coordinate={myPosition} tracksViewChanges={false}>
          <View style={styles.pinWrap}>
            <View style={styles.youTile}>
              <Text style={styles.youTileText}>You</Text>
            </View>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
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
});
