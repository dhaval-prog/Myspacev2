import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import type { FriendsMapCanvasProps } from './friendsMapCanvasTypes';

const DEFAULT_CENTER = { latitude: 21.5, longitude: 79.5 };
const DEFAULT_ZOOM_256 = 4;
const TILE_SIZE = 256;

function worldWidth(zoom256: number): number {
  return TILE_SIZE * 2 ** zoom256;
}

/** Longitude span a `zoom256` level shows across a viewport of `widthPx` — inverse of
 * `zoomFromLongitudeDelta` below. react-native-maps has no first-class "zoom" concept (Apple/
 * Google Maps regions are expressed as lat/lng deltas), so this and its inverse are the bridge
 * between this feature's own 256px-tile zoom convention (see friendsMapMath.ts) and a `Region`. */
function regionFromCamera(center: { latitude: number; longitude: number }, zoom256: number, widthPx: number): Region {
  const longitudeDelta = (360 * widthPx) / worldWidth(zoom256);
  // Apple/Google Maps regions are plain lat/lng boxes (no Mercator correction) — approximating
  // latitudeDelta as equal to longitudeDelta is the same simplification react-native-maps' own
  // docs use, and is only ever a *display* hint (user gestures still drive the authoritative
  // on-screen camera) rather than something clustering/fit math depends on being exact.
  return { ...center, latitudeDelta: longitudeDelta, longitudeDelta };
}

function zoomFromLongitudeDelta(longitudeDelta: number, widthPx: number): number {
  return Math.log2((360 * widthPx) / (longitudeDelta * TILE_SIZE));
}

/**
 * The Friends Map's real, draggable/zoomable world map — react-native-maps (Apple/Google Maps),
 * same declarative-pins + imperative-camera-command shape as the web canvas. Unlike the web
 * canvas's `map.project()`, react-native-maps has no synchronous screen-projection call, so pins
 * are real `<Marker>`s the SDK positions itself (same approach `ThrowMap.native.tsx` already
 * uses) rather than absolutely-positioned views we project ourselves.
 */
export function FriendsMapCanvas({ me, pins, renderPin, renderMe, cameraCommand, onCameraChange }: FriendsMapCanvasProps) {
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [widthPx, setWidthPx] = useState(390);
  const lastCommandTokenRef = useRef<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => setWidthPx(e.nativeEvent.layout.width);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !cameraCommand || cameraCommand.token === lastCommandTokenRef.current) return;
    lastCommandTokenRef.current = cameraCommand.token;
    if (cameraCommand.kind === 'jump') {
      map.animateToRegion(regionFromCamera(cameraCommand.center, cameraCommand.zoom, widthPx), 0);
    } else {
      map.fitToCoordinates(cameraCommand.points, { edgePadding: { top: 80, right: 60, bottom: 80, left: 60 }, animated: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraCommand?.token, mapReady, widthPx]);

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={regionFromCamera(DEFAULT_CENTER, DEFAULT_ZOOM_256, widthPx)}
        rotateEnabled={false}
        pitchEnabled={false}
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={(region: Region) => {
          onCameraChange({
            zoom: zoomFromLongitudeDelta(region.longitudeDelta, widthPx),
            center: { latitude: region.latitude, longitude: region.longitude },
          });
        }}
      >
        {me && (
          <Marker coordinate={me} anchor={{ x: 0.5, y: 0.5 }} zIndex={1} tracksViewChanges={false}>
            <View>{renderMe ? renderMe() : null}</View>
          </Marker>
        )}
        {pins.map((pin) => (
          <Marker key={pin.id} coordinate={{ latitude: pin.latitude, longitude: pin.longitude }} tracksViewChanges={true} anchor={{ x: 0.5, y: 0.5 }} zIndex={pin.zIndex}>
            <View>{renderPin(pin)}</View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}
