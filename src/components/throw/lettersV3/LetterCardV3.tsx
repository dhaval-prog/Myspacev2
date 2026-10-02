import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';
import { Icon } from '../../Icon';
import { LetterPlaneGlyph } from '../inbox/LetterPlaneGlyph';
import { v3Color, v3Font, v3Layout, v3Radius } from '../../../theme/throwLettersV3Tokens';
import type { LetterStageV3, V3LetterCardData } from '../../../hooks/useLettersArrivalV3';

const BELL_ICON = 'M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z M10 20.5a2 2 0 0 0 4 0';
const PAPERCLIP_ICON = 'M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8';

// react-native-svg's web typings omit `children` on Defs (a typing gap, not a runtime issue,
// already worked around the same way in NpatGlassBackdrop) — cast once.
const DefsAny = Defs as unknown as React.ComponentType<{ children?: React.ReactNode }>;

const s = (n: number, scale: number) => n * scale;

const EASE_ENV_IN = Easing.bezier(0.3, 1.5, 0.5, 1);
const EASE_ENV_OUT = Easing.bezier(0.5, 0, 0.8, 0.4);
const EASE_RISE = Easing.bezier(0.3, 1.2, 0.5, 1);
const EASE_DEFAULT = Easing.bezier(0.3, 1.25, 0.5, 1);
const EASE_SHRINK = Easing.bezier(0.5, 0, 0.8, 0.4);
const EASE_FLAP = Easing.bezier(0.4, 0, 0.2, 1);
const EASE_UNFOLD = Easing.bezier(0.55, 0, 0.25, 1);

interface LetterTarget {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
  durMs: number;
  easing: (t: number) => number;
  opDurMs: number;
  opDelayMs: number;
}

function letterTargetFor(stage: LetterStageV3): LetterTarget {
  const inEnv = stage === 'hidden' || stage === 'flying' || stage === 'empty' || stage === 'landed' || stage === 'flap';
  // Tucked inside the envelope's own 190-tall window (not the handoff's literal translateY(130)/
  // scale(.8) — those numbers assume CSS's `transform-origin:50% 0`, and even with this card's own
  // matching `transformOrigin` the resulting box still runs well past the envelope's own bottom
  // edge, showing as a second, disconnected panel poking out below it). Shrunk enough, with the
  // right translate, to land entirely within the envelope's own bounds instead.
  // Opacity stays 0 through every tucked stage, including 'flap' — the pocket's own notch cutout
  // (added after this opacity:1-at-flap exception was written) lets whatever sits behind it at that
  // exact spot show through, so a fully-opaque, already-positioned letter pokes up through the gap
  // the instant the flap opens, well before it's meant to become visible at 'rise'.
  if (inEnv) return { x: 0, y: 95, scale: 0.6, rotate: 0, opacity: 0, durMs: 0, easing: Easing.linear, opDurMs: 0, opDelayMs: 0 };
  if (stage === 'rise') return { x: 0, y: -26, scale: 0.86, rotate: 0, opacity: 1, durMs: 600, easing: EASE_RISE, opDurMs: 0, opDelayMs: 0 };
  if (stage === 'shrink') return { x: 0, y: 260, scale: 0.25, rotate: 10, opacity: 0, durMs: 340, easing: EASE_SHRINK, opDurMs: 300, opDelayMs: 50 };
  if (stage === 'trash') return { x: 0, y: 360, scale: 0.12, rotate: 16, opacity: 0, durMs: 500, easing: EASE_SHRINK, opDurMs: 350, opDelayMs: 150 };
  return { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, durMs: 500, easing: EASE_DEFAULT, opDurMs: 300, opDelayMs: 0 };
}

interface EnvTarget {
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
  durMs: number;
  opDurMs: number;
  opDelayMs: number;
}

function envTargetFor(stage: LetterStageV3): EnvTarget {
  if (stage === 'hidden' || stage === 'flying' || stage === 'empty') return { y: 0, scale: 0.3, rotate: -24, opacity: 0, durMs: 0, opDurMs: 0, opDelayMs: 0 };
  if (stage === 'landed' || stage === 'flap' || stage === 'rise') return { y: 0, scale: 1, rotate: -2, opacity: 1, durMs: 500, opDurMs: 200, opDelayMs: 0 };
  if (stage === 'drop') return { y: 240, scale: 0.9, rotate: 6, opacity: 0, durMs: 500, opDurMs: 350, opDelayMs: 120 };
  return { y: 240, scale: 0.9, rotate: 6, opacity: 0, durMs: 0, opDurMs: 0, opDelayMs: 0 };
}

function runTiming(v: Animated.Value, toValue: number, durMs: number, easing: (t: number) => number, delayMs = 0) {
  if (durMs <= 0) {
    v.setValue(toValue);
    return;
  }
  Animated.timing(v, { toValue, duration: durMs, delay: delayMs, easing, useNativeDriver: true }).start();
}

/**
 * The envelope → flap-opens → letter-rises-and-drops → unfolds sequence — ported stage-for-stage
 * from the design handoff's own `renderVals()` (`envT`/`letterT`/`flapT`/`botT` and their own
 * transition strings), using one `Animated.Value` per CSS property it drives and `Animated.timing`
 * calls that match each transition's own duration/easing/delay exactly, the same "snap to a target
 * whenever the stage prop changes" convention LetterFoldCard's own tri-fold uses for the in-place
 * panel. `stage==='open'` additionally exposes nothing extra here — ActionRowV3/ChipsRowV3 (siblings,
 * not children) derive their own visibility from the same `stage` prop independently.
 */
export function LetterCardV3({ stage, letter, isEmpty, emptyName, scale }: { stage: LetterStageV3; letter: V3LetterCardData | null; isEmpty: boolean; emptyName: string; scale: number }) {
  const w = s(v3Layout.letter.w, scale);
  const h = s(v3Layout.letter.h, scale);
  const halfH = h / 2;

  const letterX = useRef(new Animated.Value(0)).current;
  const letterY = useRef(new Animated.Value(s(95, scale))).current;
  const letterScale = useRef(new Animated.Value(0.6)).current;
  const letterRotate = useRef(new Animated.Value(0)).current;
  const letterOpacity = useRef(new Animated.Value(0)).current;

  const envY = useRef(new Animated.Value(0)).current;
  const envScale = useRef(new Animated.Value(0.3)).current;
  const envRotate = useRef(new Animated.Value(-24)).current;
  const envOpacity = useRef(new Animated.Value(0)).current;

  const flapRotateX = useRef(new Animated.Value(0)).current;
  const botRotateX = useRef(new Animated.Value(180)).current;
  const botFrontOpacity = useRef(new Animated.Value(0)).current;
  const botBackOpacity = useRef(new Animated.Value(1)).current;
  const botShade = useRef(new Animated.Value(0.3)).current;
  // Drives the top-half/bottom-front faces' own box-shadow — folded→open, .4s, not native-driver
  // safe (shadow* isn't a transform/opacity property), same JS-driven fallback this codebase
  // already takes for everything else RN's native driver can't animate.
  const foldT = useRef(new Animated.Value(0)).current;

  // A plain `Animated.timing({duration:0, delay})` is NOT reliable for "snap to a value after a
  // delay" on web (the zero-duration animation can resolve before its own delay elapses) — ported
  // LetterFoldCard's own proven `later()` + `.setValue()` pattern instead for the bottom-half face
  // swap below, rather than routing it through `runTiming`'s delay handling.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const lt = letterTargetFor(stage);
    runTiming(letterX, s(lt.x, scale), lt.durMs, lt.easing);
    runTiming(letterY, s(lt.y, scale), lt.durMs, lt.easing);
    runTiming(letterScale, lt.scale, lt.durMs, lt.easing);
    runTiming(letterRotate, lt.rotate, lt.durMs, lt.easing);
    runTiming(letterOpacity, lt.opacity, lt.opDurMs, Easing.linear, lt.opDelayMs);

    const et = envTargetFor(stage);
    runTiming(envY, s(et.y, scale), et.durMs, EASE_ENV_IN);
    runTiming(envScale, et.scale, et.durMs, EASE_ENV_IN);
    runTiming(envRotate, et.rotate, et.durMs, EASE_ENV_IN);
    runTiming(envOpacity, et.opacity, et.opDurMs, Easing.linear, et.opDelayMs);
    // The 'drop' stage is the one case where the envelope's own fall-away transform uses the
    // "falling" easing instead of the "arriving" one — matches the handoff's own envTr swap.
    if (stage === 'drop') {
      runTiming(envY, s(et.y, scale), et.durMs, EASE_ENV_OUT);
      runTiming(envScale, et.scale, et.durMs, EASE_ENV_OUT);
      runTiming(envRotate, et.rotate, et.durMs, EASE_ENV_OUT);
    }

    const flapOpen = !(stage === 'hidden' || stage === 'flying' || stage === 'empty' || stage === 'landed');
    runTiming(flapRotateX, flapOpen ? 178 : 0, flapOpen ? 500 : 0, EASE_FLAP);

    const inEnv = stage === 'hidden' || stage === 'flying' || stage === 'empty' || stage === 'landed' || stage === 'flap';
    const unfolded = stage === 'unfold' || stage === 'open';
    runTiming(botRotateX, unfolded ? 0 : 180, inEnv ? 0 : 600, EASE_UNFOLD);
    // The two faces swap instantly, timed to land halfway through the 600ms unfold (300ms) — same
    // `transition: opacity 0s linear 300ms` trick the handoff uses instead of a true cross-fade, so
    // neither face is ever visibly see-through mid-flip. `later()` (not `runTiming`'s own delay —
    // see its own doc comment) so the delay is actually honored.
    if (inEnv) {
      botFrontOpacity.setValue(unfolded ? 1 : 0);
      botBackOpacity.setValue(unfolded ? 0 : 1);
    } else {
      later(() => {
        botFrontOpacity.setValue(unfolded ? 1 : 0);
        botBackOpacity.setValue(unfolded ? 0 : 1);
      }, 300);
    }
    runTiming(botShade, unfolded ? 0 : 0.3, 500, Easing.linear);
    runTiming(foldT, unfolded ? 1 : 0, 400, Easing.linear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const inEnvNow = stage === 'hidden' || stage === 'flying' || stage === 'empty' || stage === 'landed' || stage === 'flap';
  const letterZ = inEnvNow || stage === 'rise' ? 2 : 6;
  const flapOpenNow = !(stage === 'hidden' || stage === 'flying' || stage === 'empty' || stage === 'landed');
  const flapZ = flapOpenNow ? 0 : 4;

  const envStyle = {
    transform: [{ translateY: envY }, { scale: envScale }, { rotate: envRotate.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) }],
    opacity: envOpacity,
  };

  // Top half: folded `0 10px 24px rgba(0,0,0,.14)` → open `0 18px 40px rgba(0,0,0,.10)`.
  const topShadowStyle = {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: foldT.interpolate({ inputRange: [0, 1], outputRange: [s(10, scale), s(18, scale)] }) },
    shadowRadius: foldT.interpolate({ inputRange: [0, 1], outputRange: [s(24, scale), s(40, scale)] }),
    shadowOpacity: foldT.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.1] }),
  };
  // Bottom-front face: `none` folded → `0 18px 30px rgba(0,0,0,.10)` open.
  const botFrontShadowStyle = {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: s(18, scale) },
    shadowRadius: s(30, scale),
    shadowOpacity: foldT.interpolate({ inputRange: [0, 1], outputRange: [0, 0.1] }),
  };

  if (isEmpty) {
    return (
      <View style={[styles.empty, { width: w, height: h, borderRadius: s(24, scale) }]}>
        <Text style={[styles.emptyTitle, { fontSize: s(16, scale) }]}>No letters from {emptyName}</Text>
        <Text style={[styles.emptyMono, { fontSize: s(10.5, scale), letterSpacing: 1.1 }]}>NEW ONES WILL FLY IN HERE</Text>
      </View>
    );
  }

  const L = letter;

  return (
    <View pointerEvents="none" style={{ width: w, height: h }}>
      {/* Envelope inside (back) panel — the "inside the envelope" color visible once the flap
          opens, sitting below the letter itself. */}
      <Animated.View
        style={[
          styles.envInside,
          envStyle,
          {
            left: s(v3Layout.envelope.x - v3Layout.letter.x, scale),
            top: s(v3Layout.envelope.y - v3Layout.letter.y, scale),
            width: s(v3Layout.envelope.w, scale),
            height: s(v3Layout.envelope.h, scale),
            borderRadius: s(v3Radius.envelope, scale),
            shadowOffset: { width: 0, height: s(14, scale) },
            shadowRadius: s(30, scale),
            shadowOpacity: 0.16,
          },
        ]}
      />

      {/* The letter — top half (static) + bottom half (the unfolding one). `transformOrigin` matches
          the handoff's own `transform-origin:50% 0` — RN's transforms scale/rotate around the
          element's center by default, which (combined with the translate below) would land the
          card somewhere else entirely from what these values were tuned against. */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: h,
          zIndex: letterZ,
          transformOrigin: '50% 0%',
          transform: [{ translateX: letterX }, { translateY: letterY }, { scale: letterScale }, { rotate: letterRotate.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) }],
          opacity: letterOpacity,
        }}
      >
        {/* Shadow lives on this outer, non-clipping wrapper — a view with `overflow:'hidden'`
            (needed below to crop the shared ruled/body content to just this half) also clips its
            own native shadow on iOS, so the shadow and the clip can't live on the same node. */}
        <Animated.View style={[{ width: w, height: halfH, shadowColor: '#000000' }, topShadowStyle]}>
          <View style={[styles.topHalf, { width: w, height: halfH, borderTopLeftRadius: s(22, scale), borderTopRightRadius: s(22, scale) }]}>
            <View style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }}>
              <RuledLines scale={scale} h={h} />
              <HeaderRow letter={L} scale={scale} />
              <AlertPill letter={L} scale={scale} />
              <BodyText body={L?.body ?? ''} scale={scale} />
            </View>
          </View>
        </Animated.View>

        <View style={{ position: 'absolute', left: 0, top: halfH, width: w, height: halfH }}>
          <Animated.View
            style={[
              { position: 'absolute', width: w, height: halfH, shadowColor: '#000000', backfaceVisibility: 'hidden', opacity: botFrontOpacity },
              botFrontShadowStyle,
              { transform: [{ perspective: s(1400, scale) }, { rotateX: botRotateX.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] }) }] },
            ]}
          >
            <View style={[styles.botFront, { width: w, height: halfH, borderBottomLeftRadius: s(22, scale), borderBottomRightRadius: s(22, scale) }]}>
              <View style={{ position: 'absolute', left: 0, top: -halfH, width: w, height: h }}>
                <RuledLines scale={scale} h={h} />
                <HeaderRow letter={L} scale={scale} hidePostmark />
                {/* Reserves the same vertical space the top half's AlertPill actually occupies (height
                    28 + marginTop 10), rather than rendering it again, so the body text lands at the
                    identical y-offset in both halves and reads as one continuous block across the
                    fold — matches the handoff's own blank spacer in this exact spot. */}
                {!!L?.alertSchedule && <View style={{ height: s(38, scale) }} />}
                <BodyText body={L?.body ?? ''} scale={scale} />
                <SignatureRow letter={L} scale={scale} />
              </View>
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity: botShade }]} />
            </View>
          </Animated.View>
          {/* The back face doesn't rotate at all — same reasoning as LetterFoldCard's own
              `panelBack`: folding a rigid panel 180° about its own top edge lands it swung fully
              onto the front face's own slot, so there's nothing left to animate into once it gets
              there. Nesting a SECOND independent `rotateX` interpolation here (driven by the same
              `botRotateX` value, offset 180° from the front face's own) relies on RN Web composing
              two nested 3D transforms the way CSS's `transform-style:preserve-3d` would — it
              doesn't (confirmed via screenshots: the back panel visibly bled through/overlapped
              the front face's body text well into the 'unfold' stage) — so it's purely
              opacity-gated instead, snapped via `later()` at the exact halfway point above. */}
          <Animated.View
            style={{
              position: 'absolute',
              width: w,
              height: halfH,
              opacity: botBackOpacity,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: s(6, scale) },
              shadowRadius: s(16, scale),
              shadowOpacity: 0.12,
            }}
          >
            <View style={[styles.botBack, { width: w, height: halfH, borderTopLeftRadius: s(22, scale), borderTopRightRadius: s(22, scale) }]}>
              <AirmailStripes scale={scale} w={w} h={halfH} />
              <View style={[styles.backPanel, { left: s(6, scale), right: s(6, scale), top: s(6, scale), borderTopLeftRadius: s(17, scale), borderTopRightRadius: s(17, scale), paddingHorizontal: s(20, scale) }]}>
                <View style={{ gap: s(3, scale) }}>
                  <Text style={[styles.mono, { fontSize: s(10, scale), letterSpacing: 1.2 }]}>PAR AVION · TO</Text>
                  <Text style={[styles.toName, { fontSize: s(20, scale) }]}>You</Text>
                  <Text style={[styles.fromHand, { fontSize: s(20, scale) }]}>from {L?.from ?? ''}</Text>
                </View>
                <View style={[styles.postmark, { width: s(58, scale), height: s(58, scale), borderRadius: s(29, scale) }]}>
                  <Text style={[styles.mono, styles.postmarkPlace, { fontSize: s(8, scale) }]}>{L?.place ?? ''}</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>
      </Animated.View>

      {/* Envelope pocket — the "slot the letter slides out of", sitting above the inside panel but
          below the letter once it rises past it. */}
      <Animated.View
        style={[
          envStyle,
          {
            position: 'absolute',
            left: s(v3Layout.envelope.x - v3Layout.letter.x, scale),
            top: s(v3Layout.envelope.y - v3Layout.letter.y, scale),
            width: s(v3Layout.envelope.w, scale),
            height: s(v3Layout.envelope.h, scale),
            zIndex: 3,
          },
        ]}
      >
        <EnvelopePocket scale={scale} fromName={L?.from ?? emptyName} place={L?.place ?? ''} />
      </Animated.View>

      {/* Envelope flap — the triangular lid that rotates open about its top edge. */}
      <Animated.View
        style={[
          envStyle,
          {
            position: 'absolute',
            left: s(v3Layout.envelope.x - v3Layout.letter.x, scale),
            top: s(v3Layout.envelope.y - v3Layout.letter.y, scale),
            width: s(v3Layout.envelope.w, scale),
            height: s(v3Layout.envelope.h, scale),
            zIndex: flapZ,
          },
        ]}
      >
        <Animated.View
          style={{
            width: s(v3Layout.envelope.w, scale),
            height: s(v3Layout.envelope.flapH, scale),
            transform: [{ perspective: s(800, scale) }, { rotateX: flapRotateX.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] }) }],
          }}
        >
          <EnvelopeFlap scale={scale} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** The envelope's front pocket — `clip-path:polygon(0 0,50% 56%,100% 0,100% 100%,0 100%)` outer
 * (striped) and a matching, slightly-smaller inner polygon (inset 6/6/0/6) in plain pocket color —
 * i.e. a rectangle with a downward-pointing notch cut out of its top edge, so the envelope's inside
 * color (behind it) shows through that notch. Built as two separately-clipped SVG shapes rather
 * than one, same "draw the real shape" approach `TriangleFlap` already uses for the flap. */
function EnvelopePocket({ scale, fromName, place }: { scale: number; fromName: string; place: string }) {
  const w = s(v3Layout.envelope.w, scale);
  const h = s(v3Layout.envelope.h, scale);
  const inset = s(v3Layout.envelope.stripeInset, scale);
  const innerW = w - inset * 2;
  const innerH = h - inset;
  const notchYOuter = h * 0.56;
  const notchYInner = innerH * 0.54;
  const period = s(STRIPE_PERIOD, scale);
  return (
    <View style={{ width: w, height: h, borderRadius: s(10, scale), overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 0, top: 0 }}>
        <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <DefsAny>
            <ClipPath id="pocketOuter">
              <Polygon points={`0,0 ${w / 2},${notchYOuter} ${w},0 ${w},${h} 0,${h}`} />
            </ClipPath>
          </DefsAny>
          <Rect x={0} y={0} width={w} height={h} fill={v3Color.envelopePocket} clipPath="url(#pocketOuter)" />
          <ClippedStripeBars w={w} h={h} period={period} clipId="pocketOuter" />
        </Svg>
      </View>
      {/* Seam lines — drawn over the outer stripe, under the inner panel's own fill. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
        <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <Path
            d={`M0,${s(178, scale)} L${s(128, scale)},${s(92, scale)} M${s(288, scale)},${s(178, scale)} L${s(160, scale)},${s(92, scale)}`}
            stroke="rgba(0,0,0,0.07)"
            strokeWidth={1.5 * scale}
            fill="none"
          />
        </Svg>
      </View>
      <View style={{ position: 'absolute', left: inset, top: inset }}>
        <Svg width={innerW} height={innerH} viewBox={`0 0 ${innerW} ${innerH}`}>
          <DefsAny>
            <ClipPath id="pocketInner">
              <Polygon points={`0,0 ${innerW / 2},${notchYInner} ${innerW},0 ${innerW},${innerH} 0,${innerH}`} />
            </ClipPath>
          </DefsAny>
          <Rect x={0} y={0} width={innerW} height={innerH} fill={v3Color.envelopePocket} clipPath="url(#pocketInner)" />
        </Svg>
      </View>
      <View style={{ position: 'absolute', left: s(16, scale), bottom: s(14, scale), gap: 2 }}>
        <Text style={[styles.mono, { fontSize: s(9, scale), letterSpacing: 1.3 }]}>FROM</Text>
        <Text style={[styles.fromHand, { fontSize: s(22, scale) }]}>{fromName}</Text>
      </View>
      <View style={[styles.postmark, { position: 'absolute', right: s(16, scale), bottom: s(12, scale), width: s(50, scale), height: s(50, scale), borderRadius: s(25, scale), transform: [{ rotate: '-14deg' }] }]}>
        <Text style={[styles.mono, styles.postmarkPlace, { fontSize: s(7.5, scale) }]}>{place}</Text>
      </View>
    </View>
  );
}

function EnvelopeFlap({ scale }: { scale: number }) {
  const w = s(v3Layout.envelope.w, scale);
  const h = s(v3Layout.envelope.flapH, scale);
  const seal = s(v3Layout.envelope.seal, scale);
  return (
    <View style={{ width: w, height: h }}>
      <TriangleFlap scale={scale} w={w} h={h} />
      <View
        style={[
          styles.seal,
          {
            left: w / 2 - seal / 2,
            top: s(82, scale),
            width: seal,
            height: seal,
            borderRadius: seal / 2,
            shadowOffset: { width: 0, height: s(3, scale) },
            shadowRadius: s(8, scale),
            shadowOpacity: 0.4,
          },
        ]}
      >
        {/* `inset 0 0 0 3px rgba(255,255,255,.18)` — RN has no inset shadow, so the ring is a plain
            inner border instead, same "draw the real thing" approach used elsewhere in this file. */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: seal / 2, borderWidth: s(3, scale), borderColor: 'rgba(255,255,255,0.18)' }]} />
        <LetterPlaneGlyph size={s(20, scale)} variant="active" tiltDeg={-14} />
      </View>
    </View>
  );
}

const STRIPE_PERIOD = 20;

/** The flap's own striped triangle — a downward-pointing isoceles triangle (apex at bottom-center)
 * clipped out of the airmail stripe pattern, the SVG equivalent of the handoff's own CSS
 * `clip-path: polygon(0 0,100% 0,50% 100%)` (RN has no clip-path, but `react-native-svg`'s own
 * `ClipPath` works identically on every platform) — same "draw the real shape in SVG instead of
 * porting the CSS trick literally" approach LetterFoldCard's own NoseFlap triangles already use
 * for the in-place panel's tri-fold. */
function TriangleFlap({ scale, w, h }: { scale: number; w: number; h: number }) {
  const period = s(STRIPE_PERIOD, scale);
  return (
    <View style={{ width: w, height: h, borderTopLeftRadius: s(10, scale), borderTopRightRadius: s(10, scale), overflow: 'hidden' }}>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <DefsAny>
          <ClipPath id="flapTriangle">
            <Polygon points={`0,0 ${w},0 ${w / 2},${h}`} />
          </ClipPath>
        </DefsAny>
        <Rect x={0} y={0} width={w} height={h} fill={v3Color.envelopeFlap} clipPath="url(#flapTriangle)" />
        {/* The diagonal stripe — alternating blue bars at 135°, clipped to the same triangle. */}
        <ClippedStripeBars w={w} h={h} period={period} clipId="flapTriangle" />
        {/* The flap's own slightly-inset, unstriped inner triangle, with a faint top→bottom shading
            — `polygon(9px 6px,291px 6px,50% 102px)` + `linear-gradient(180deg,transparent 40%,
            rgba(0,0,0,.06))`, drawn on top of the striped outer triangle. */}
        <DefsAny>
          <ClipPath id="flapInner">
            <Polygon points={`${s(9, scale)},${s(6, scale)} ${s(291, scale)},${s(6, scale)} ${w / 2},${s(102, scale)}`} />
          </ClipPath>
          <LinearGradient id="flapShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor="#000000" stopOpacity={0} />
            <Stop offset={0.4} stopColor="#000000" stopOpacity={0} />
            <Stop offset={1} stopColor="#000000" stopOpacity={0.06} />
          </LinearGradient>
        </DefsAny>
        <Rect x={0} y={0} width={w} height={h} fill={v3Color.envelopeFlap} clipPath="url(#flapInner)" />
        <Rect x={0} y={0} width={w} height={h} fill="url(#flapShade)" clipPath="url(#flapInner)" />
      </Svg>
    </View>
  );
}

/** Shared diagonal-stripe-bar renderer for any SVG shape clipped to `clipId` (the flap's triangle,
 * the pocket's notched pentagon) — alternating blue bars at 135°, oversized so the clip (not this
 * component) decides the final visible shape. The whole set of bars is laid out unrotated first,
 * then rotated together as a single rigid group about one shared pivot — rotating each bar
 * individually about its own center (the previous approach) only looks right near that pivot and
 * visibly warps into uneven, broken-looking blobs away from it, since each bar's own position never
 * revolves around the shared pivot the way a true rotated fill would. */
function ClippedStripeBars({ w, h, period, clipId }: { w: number; h: number; period: number; clipId: string }) {
  const diag = Math.ceil(Math.sqrt(w * w + h * h)) + period * 2;
  const bars = Math.ceil(diag / period) + 2;
  const cx = w / 2;
  const cy = h / 2;
  return (
    <G clipPath={`url(#${clipId})`}>
      <G transform={`rotate(-45 ${cx} ${cy})`}>
        {Array.from({ length: bars }).map((_, i) => {
          const offset = -diag / 2 + i * period;
          return <Rect key={i} x={cx + offset} y={cy - diag / 2} width={period / 2} height={diag} fill={v3Color.accentBlue} />;
        })}
      </G>
    </G>
  );
}

/** Diagonal repeating airmail stripe for a plain rectangle (the pocket's own inner panel, the
 * letter's back-panel face) — the CSS `repeating-linear-gradient(135deg,#2F6BFF 0 10px,<bg> 10px
 * 20px)`, built from a tiled, rotated strip of alternating bars rather than a true gradient (RN
 * has no repeating-linear-gradient), oversized and clipped by the parent's own
 * `overflow:'hidden'` so the rotation never shows a gap at the edges. */
function AirmailStripes({ scale, w, h, bg = v3Color.paperBack }: { scale: number; w: number; h: number; bg?: string }) {
  const barW = s(10, scale);
  const period = barW * 2;
  const diag = Math.ceil(Math.sqrt(w * w + h * h)) + period * 2;
  const bars = Math.ceil(diag / period) + 2;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0, overflow: 'hidden' } as object}>
      <View style={{ position: 'absolute', left: -diag / 2 + w / 2, top: -diag / 2 + h / 2, width: diag, height: diag, backgroundColor: bg, transform: [{ rotate: '-45deg' }] }}>
        {Array.from({ length: bars }).map((_, i) => (
          <View key={i} style={{ position: 'absolute', left: i * period, top: 0, width: barW, height: diag, backgroundColor: v3Color.accentBlue }} />
        ))}
      </View>
    </View>
  );
}

function RuledLines({ scale, h }: { scale: number; h: number }) {
  const top = s(v3Layout.letter.rulesTop, scale);
  const bottom = s(v3Layout.letter.rulesBottom, scale);
  // `repeating-linear-gradient(transparent 0 33px, rgba(...) 33px 34px)` — a 34px repeat with the
  // first rule landing at y=33, not a 33px repeat starting at y=0.
  const lineGap = s(34, scale);
  const offset = s(33, scale);
  const count = Math.ceil((h - top - bottom - s(33, scale)) / lineGap) + 1;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: s(24, scale), right: s(24, scale), top, bottom, overflow: 'hidden' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ position: 'absolute', top: offset + i * lineGap, left: 0, right: 0, height: 1, backgroundColor: v3Color.ruleLine }} />
      ))}
    </View>
  );
}

function HeaderRow({ letter, scale, hidePostmark }: { letter: V3LetterCardData | null; scale: number; hidePostmark?: boolean }) {
  return (
    <View style={{ paddingHorizontal: s(24, scale), paddingTop: s(20, scale), flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: s(12, scale) }}>
      <View style={{ gap: s(4, scale) }}>
        <Text style={[styles.fromLabel, { fontSize: s(12, scale) }]}>From</Text>
        <Text style={[styles.fromName, { fontSize: s(20, scale) }]}>{letter?.from ?? ''}</Text>
        <Text style={[styles.mono, { fontSize: s(10.5, scale), letterSpacing: 0.9 }]}>{letter?.date ?? ''}</Text>
      </View>
      {!hidePostmark && (
        <View style={[styles.postmark, { width: s(60, scale), height: s(60, scale), borderRadius: s(30, scale), transform: [{ rotate: '-12deg' }] }]}>
          <Text style={[styles.mono, styles.postmarkPlace, { fontSize: s(8, scale) }]}>{letter?.place ?? ''}</Text>
          <Text style={[styles.mono, styles.postmarkKm, { fontSize: s(8.5, scale) }]}>{letter?.km ?? ''}</Text>
        </View>
      )}
    </View>
  );
}

function AlertPill({ letter, scale }: { letter: V3LetterCardData | null; scale: number }) {
  if (!letter?.alertSchedule) return null;
  const confirmed = letter.alertConfirmed;
  return (
    <View style={{ marginHorizontal: s(24, scale), marginTop: s(10, scale) }}>
      <View
        style={[
          styles.alertPill,
          { height: s(28, scale), paddingHorizontal: s(12, scale), borderRadius: s(14, scale), gap: s(7, scale), backgroundColor: confirmed ? v3Color.accentBlue : v3Color.accentBlueTint },
        ]}
      >
        <Icon path={BELL_ICON} size={s(13, scale)} color={confirmed ? '#FFFFFF' : v3Color.accentBlue} strokeWidth={2.2} />
        <Text style={[styles.mono, { fontSize: s(9.5, scale), letterSpacing: 0.5, color: confirmed ? '#FFFFFF' : v3Color.accentBlue }]} numberOfLines={1}>
          {confirmed ? 'ALERT SET' : 'ALERT'}
        </Text>
      </View>
    </View>
  );
}

function BodyText({ body, scale }: { body: string; scale: number }) {
  return (
    <Text style={[styles.body, { fontSize: s(25, scale), lineHeight: s(34, scale), paddingHorizontal: s(24, scale), paddingTop: s(10, scale) }]}>{body}</Text>
  );
}

function SignatureRow({ letter, scale }: { letter: V3LetterCardData | null; scale: number }) {
  return (
    <View style={{ position: 'absolute', left: s(24, scale), right: s(24, scale), bottom: s(18, scale), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(10, scale) }}>
      <Text style={[styles.sig, { fontSize: s(22, scale) }]}>{letter?.sig ?? ''}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10, scale) }}>
        {!!letter?.mediaLabel && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5, scale) }}>
            <Icon path={PAPERCLIP_ICON} size={s(12, scale)} color={v3Color.accentBlue} strokeWidth={2.2} />
            <Text style={[styles.mono, { fontSize: s(9.5, scale), letterSpacing: 0.6, color: v3Color.accentBlue }]} numberOfLines={1}>
              {letter.mediaLabel}
            </Text>
          </View>
        )}
        <Text style={[styles.mono, { fontSize: s(10.5, scale), color: v3Color.muted }]}>{letter?.count ?? ''}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyTitle: { fontFamily: v3Font.ui800, color: v3Color.ink },
  emptyMono: { fontFamily: v3Font.mono, color: v3Color.mutedDark },
  envInside: { position: 'absolute', backgroundColor: v3Color.envelopeInside, shadowColor: '#000000' },
  topHalf: { backgroundColor: v3Color.paper, overflow: 'hidden' },
  botFront: { backgroundColor: v3Color.paper, overflow: 'hidden' },
  botBack: { overflow: 'hidden' },
  backPanel: { position: 'absolute', bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: v3Color.envelopeFlap },
  toName: { fontFamily: v3Font.ui800, color: v3Color.ink },
  fromHand: { fontFamily: v3Font.hand600, color: v3Color.inkBlue },
  postmark: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(47,107,255,.55)', alignItems: 'center', justifyContent: 'center' },
  postmarkPlace: { color: v3Color.accentBlue, letterSpacing: 0.3 },
  postmarkKm: { color: 'rgba(47,107,255,.8)' },
  mono: { fontFamily: v3Font.mono, color: v3Color.muted },
  fromLabel: { fontFamily: v3Font.ui700, color: v3Color.muted },
  fromName: { fontFamily: v3Font.ui800, color: v3Color.ink },
  alertPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  body: { fontFamily: v3Font.hand, color: v3Color.inkBlue },
  sig: { fontFamily: v3Font.hand600, color: v3Color.inkBlue },
  seal: { position: 'absolute', backgroundColor: v3Color.accentBlue, alignItems: 'center', justifyContent: 'center', shadowColor: v3Color.accentBlue },
});
