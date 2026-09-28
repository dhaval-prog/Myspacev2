import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const PRESENCE_DURATION_MS = 1800;
// How long one blob takes to drift the whole width at wind speed BASE_WIND_KPH — scaled down (i.e.
// faster) by real wind speed the same way every other renderer here does.
const BASE_DRIFT_MS = 42000;
const BASE_WIND_KPH = 14;

interface CloudBlob {
  y: number;
  widthFactor: number;
  heightFactor: number;
  opacity: number;
  phase: number;
  speedFactor: number;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function generateBlobs(count: number): CloudBlob[] {
  const blobs: CloudBlob[] = [];
  for (let i = 0; i < count; i++) {
    blobs.push({
      y: randomBetween(0.05, 0.65),
      widthFactor: randomBetween(0.55, 0.95),
      heightFactor: randomBetween(0.16, 0.26),
      opacity: randomBetween(0.35, 0.6),
      phase: Math.random(),
      speedFactor: randomBetween(0.7, 1.3),
    });
  }
  return blobs;
}

interface CloudOverlayProps {
  active: boolean;
  /** A darker, denser sky — thunderstorm/lightning's own backdrop rather than an ordinary cloudy
   * day's lighter one. */
  dark?: boolean;
  windSpeedKph?: number;
  /** Fewer, larger blobs read as calmer/plainer cloud cover; more, smaller ones read as denser. */
  blobCount?: number;
}

/**
 * A handful of large, very soft translucent shapes drifting slowly across the top of the map, plus
 * an atmospheric darken wash underneath everything else — deliberately not a particle system (only
 * a few Animated nodes total, so this stays a single cross-platform component rather than needing
 * RainOverlay's own native/canvas split) and deliberately soft-edged/low-opacity rather than
 * cartoon cumulus shapes, per this feature's own "avoid cartoon-style clouds" note.
 */
export function CloudOverlay({ active, dark = false, windSpeedKph = BASE_WIND_KPH, blobCount = 4 }: CloudOverlayProps) {
  const presence = useRef(new Animated.Value(0)).current;
  const clock = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const blobs = useMemo(() => generateBlobs(blobCount), [blobCount]);

  useEffect(() => {
    Animated.timing(presence, {
      toValue: active ? 1 : 0,
      duration: PRESENCE_DURATION_MS,
      easing: active ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, presence]);

  const speedKph = Math.max(2, windSpeedKph || BASE_WIND_KPH);
  useEffect(() => {
    clock.setValue(0);
    const duration = Math.max(9000, BASE_DRIFT_MS * (BASE_WIND_KPH / speedKph));
    const loop = Animated.loop(Animated.timing(clock, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }));
    loopRef.current = loop;
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedKph]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: Animated.multiply(presence, dark ? 0.5 : 0.22) }]}
      >
        <LinearGradient
          colors={dark ? ['rgba(8,12,20,0.9)', 'rgba(8,12,20,0.35)'] : ['rgba(70,80,95,0.5)', 'rgba(70,80,95,0.05)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {blobs.map((b, i) => {
        const progress = Animated.modulo(Animated.add(Animated.multiply(clock, b.speedFactor), b.phase), 1);
        const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-120, 120] });
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: `${-15 + i * 30}%`,
              top: `${b.y * 100}%`,
              width: `${b.widthFactor * 90}%`,
              height: `${b.heightFactor * 100}%`,
              borderRadius: 9999,
              backgroundColor: dark ? 'rgba(30,34,44,0.55)' : 'rgba(255,255,255,0.4)',
              opacity: Animated.multiply(presence, b.opacity),
              transform: [{ translateX }],
            }}
          />
        );
      })}
    </View>
  );
}
