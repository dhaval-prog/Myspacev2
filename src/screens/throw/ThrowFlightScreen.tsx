import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThrowMap } from '../../components/throw/ThrowMap';
import { PaperPlane } from '../../components/throw/PaperPlane';
import { GlassSurface } from '../../components/friends/GlassSurface';
import { throwColor, throwFont, throwGlass, throwRadius } from '../../theme/throwTokens';
import { formatMiles } from '../../utils/geo';
import { flightPath } from '../../utils/mapProjection';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { LatLng } from '../../utils/geo';
import type { ThrowMapPin } from '../../components/throw/throwMapTypes';

type Phase = 'folding' | 'launching' | 'in_flight' | 'arriving' | 'delivered';

interface ThrowFlightScreenProps {
  recipientName: string;
  recipientCity: string;
  recipientCountry: string;
  distanceMiles: number;
  from: LatLng;
  to: LatLng;
  onDone: () => void;
}

function flightDurationMs(miles: number): number {
  const t = Math.min(1, miles / 10000);
  return Math.round(3000 + t * 3500);
}

export function ThrowFlightScreen({ recipientName, recipientCity, recipientCountry, distanceMiles, from, to, onDone }: ThrowFlightScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('folding');
  const [progress, setProgress] = useState(0);

  const foldAnim = useRef(new Animated.Value(0)).current;
  const mapAnim = useRef(new Animated.Value(0)).current;
  const flightAnim = useRef(new Animated.Value(0)).current;
  const arrivalAnim = useRef(new Animated.Value(0)).current;

  const points = useMemo(() => flightPath(from, to), [from, to]);
  const fitPoints = useMemo(() => [from, to], [from, to]);
  const pins: ThrowMapPin[] = useMemo(
    () => [
      { id: 'from', latitude: from.latitude, longitude: from.longitude, label: 'From', isSelf: true },
      { id: 'to', latitude: to.latitude, longitude: to.longitude, label: recipientName.split(' ')[0] },
    ],
    [from, to, recipientName]
  );
  const durationMs = useMemo(() => flightDurationMs(distanceMiles), [distanceMiles]);
  const milesToGo = Math.max(0, Math.round(distanceMiles * (1 - progress)));

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (reduceMotion) {
        // Skips the fold/zoom flourish (the large-scale motion reduced-motion cares about) but
        // still plays a real, shorter flight — jumping straight to a static 'delivered' state
        // made the plane's journey (the whole point of this screen) invisible rather than just
        // less flashy.
        setPhase('in_flight');
        await animate(mapAnim, 1, 300);
        if (cancelled) return;

        flightAnim.setValue(0);
        const listenerId = flightAnim.addListener(({ value }) => setProgress(value));
        await animate(flightAnim, 1, 1400, Easing.linear);
        flightAnim.removeListener(listenerId);
        if (cancelled) return;

        setPhase('delivered');
        await animate(arrivalAnim, 1, 300);
        return;
      }

      await animate(foldAnim, 1, 650, Easing.out(Easing.cubic));
      if (cancelled) return;
      setPhase('launching');
      await animate(mapAnim, 1, 600, Easing.out(Easing.cubic));
      if (cancelled) return;
      setPhase('in_flight');

      flightAnim.setValue(0);
      const listenerId = flightAnim.addListener(({ value }) => setProgress(value));
      await animate(flightAnim, 1, durationMs, Easing.inOut(Easing.cubic));
      flightAnim.removeListener(listenerId);
      if (cancelled) return;

      setPhase('arriving');
      // Long enough for the landing pulse (a 550ms one-shot, see LandingPulse) to fully play out
      // at the recipient's pin before the map view is torn down for the arrival card.
      await new Promise((r) => setTimeout(r, 600));
      if (cancelled) return;

      setPhase('delivered');
      await animate(arrivalAnim, 1, 350, Easing.out(Easing.cubic));
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const foldScaleX = foldAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.15] });
  const foldRotate = foldAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-18deg'] });
  const planeOpacity = foldAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] });
  const paperOpacity = foldAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] });

  const mapOpacity = mapAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const mapScale = mapAnim.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] });

  return (
    <View style={styles.screen}>
      {phase === 'folding' && (
        <View style={styles.foldCenter}>
          <Animated.View style={{ opacity: paperOpacity, transform: [{ scaleX: foldScaleX }, { rotate: foldRotate }] }}>
            <View style={styles.paperRect} />
          </Animated.View>
          <Animated.View style={[styles.foldPlaneWrap, { opacity: planeOpacity }]}>
            <PaperPlane size={48} color={throwColor.clayDeep} />
          </Animated.View>
        </View>
      )}

      {phase !== 'folding' && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: mapOpacity, transform: [{ scale: mapScale }] }]}>
          <View style={styles.mapArea}>
            <ThrowMap
              pins={pins}
              fitPoints={fitPoints}
              route={{ points, progress, showPlane: phase === 'in_flight' || phase === 'arriving', landing: phase === 'arriving' }}
            />
          </View>

          {phase === 'in_flight' && (
            <View style={[styles.progressWrap, { top: insets.top + 20 }]}>
              <Text style={styles.progressText}>{milesToGo > 0 ? `${formatMiles(milesToGo)} to go` : 'Arriving…'}</Text>
            </View>
          )}
        </Animated.View>
      )}

      {phase === 'delivered' && (
        <Animated.View style={[styles.arrivalCardWrap, { opacity: arrivalAnim, bottom: insets.bottom + 30 }]}>
          <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.arrivalCard}>
            <Text style={styles.arrivalTitle}>Your letter has landed</Text>
            <Text style={styles.arrivalBody}>
              With {recipientName} in {recipientCity} · {formatMiles(distanceMiles)} away
            </Text>
            <Pressable onPress={onDone}>
              <View style={styles.arrivalBtn}>
                <Text style={styles.arrivalBtnLabel}>Back to map</Text>
              </View>
            </Pressable>
          </GlassSurface>
        </Animated.View>
      )}
    </View>
  );
}

function animate(value: Animated.Value, toValue: number, duration: number, easing?: (t: number) => number): Promise<void> {
  return new Promise((resolve) => {
    Animated.timing(value, { toValue, duration, easing, useNativeDriver: false }).start(() => resolve());
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: throwColor.screenBg },
  foldCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  paperRect: { width: 90, height: 60, backgroundColor: throwColor.paper, borderRadius: 6, ...throwColor.shadowSoft },
  foldPlaneWrap: { position: 'absolute' },
  mapArea: { flex: 1, marginHorizontal: 0 },
  progressWrap: { position: 'absolute', alignSelf: 'center' },
  progressText: {
    fontFamily: throwFont.mono500,
    fontSize: 12,
    color: throwColor.ink,
    backgroundColor: 'rgba(251,246,236,.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: throwRadius.pill,
    overflow: 'hidden',
  },
  arrivalCardWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    borderRadius: throwRadius.card,
    ...throwColor.shadowSoft,
  },
  arrivalCard: {
    borderRadius: throwRadius.card,
    borderWidth: 1,
    borderColor: throwGlass.border,
    padding: 20,
    alignItems: 'center',
  },
  arrivalTitle: { fontFamily: throwFont.hand700, fontSize: 24, color: throwColor.ink },
  arrivalBody: { fontFamily: throwFont.ui400, fontSize: 13, color: throwColor.inkSoft, marginTop: 6, marginBottom: 16 },
  arrivalBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: throwRadius.pill, backgroundColor: throwColor.ink },
  arrivalBtnLabel: { fontFamily: throwFont.ui700, fontSize: 13.5, color: throwColor.paper },
});
