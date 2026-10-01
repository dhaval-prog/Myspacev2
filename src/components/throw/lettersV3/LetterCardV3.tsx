import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, Polygon, Rect } from 'react-native-svg';
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
  if (inEnv) return { x: 0, y: 130, scale: 0.8, rotate: 0, opacity: stage === 'flap' ? 1 : 0, durMs: 0, easing: Easing.linear, opDurMs: 0, opDelayMs: 0 };
  if (stage === 'rise') return { x: 0, y: -26, scale: 0.86, rotate: 0, opacity: 1, durMs: 600, easing: EASE_RISE, opDurMs: 0, opDelayMs: 0 };
  if (stage === 'shrink') return { x: 0, y: 260, scale: 0.25, rotate: 10, opacity: 0, durMs: 340, easing: EASE_SHRINK, opDurMs: 300, opDelayMs: 50 };
  if (stage === 'trash') return { x: 0, y: 360, scale: 0.12, rotate: 16, opacity: 0, durMs: 500, easing: EASE_SHRINK, opDurMs: 350, opDelayMs: 150 };
  if (stage === 'replyFly') return { x: 150, y: -330, scale: 0.18, rotate: -24, opacity: 0, durMs: 500, easing: Easing.bezier(0.5, 0, 0.75, 0.3), opDurMs: 300, opDelayMs: 200 };
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
  const letterY = useRef(new Animated.Value(s(130, scale))).current;
  const letterScale = useRef(new Animated.Value(0.8)).current;
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

  useEffect(() => {
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
    // `transition: opacity 0s linear 300ms` trick the handoff uses instead of a true cross-fade,
    // so neither face is ever visibly see-through mid-flip.
    runTiming(botFrontOpacity, unfolded ? 1 : 0, 0, Easing.linear, inEnv ? 0 : 300);
    runTiming(botBackOpacity, unfolded ? 0 : 1, 0, Easing.linear, inEnv ? 0 : 300);
    runTiming(botShade, unfolded ? 0 : 0.3, 500, Easing.linear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const inEnvNow = stage === 'hidden' || stage === 'flying' || stage === 'empty' || stage === 'landed' || stage === 'flap';
  const letterZ = inEnvNow || stage === 'rise' ? 2 : 6;
  const flapOpenNow = !(stage === 'hidden' || stage === 'flying' || stage === 'empty' || stage === 'landed');
  const flapZ = flapOpenNow ? 0 : 4;

  const envStyle = {
    transform: [{ translateY: envY }, { scale: envScale }, { rotate: envRotate.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) }],
    opacity: envOpacity,
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
          },
        ]}
      />

      {/* The letter — top half (static) + bottom half (the unfolding one). */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: h,
          zIndex: letterZ,
          transform: [{ translateX: letterX }, { translateY: letterY }, { scale: letterScale }, { rotate: letterRotate.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) }],
          opacity: letterOpacity,
        }}
      >
        <View style={[styles.topHalf, { width: w, height: halfH, borderTopLeftRadius: s(22, scale), borderTopRightRadius: s(22, scale) }]}>
          <View style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }}>
            <RuledLines scale={scale} h={h} />
            <HeaderRow letter={L} scale={scale} />
            <AlertPill letter={L} scale={scale} />
            <BodyText body={L?.body ?? ''} scale={scale} />
          </View>
        </View>

        <View style={{ position: 'absolute', left: 0, top: halfH, width: w, height: halfH }}>
          <Animated.View
            style={[
              styles.botFront,
              { width: w, height: halfH, borderBottomLeftRadius: s(22, scale), borderBottomRightRadius: s(22, scale), opacity: botFrontOpacity, transform: [{ perspective: s(1400, scale) }, { rotateX: botRotateX.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] }) }] },
            ]}
          >
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
          </Animated.View>
          <Animated.View
            style={[
              styles.botBack,
              { width: w, height: halfH, opacity: botBackOpacity, transform: [{ perspective: s(1400, scale) }, { rotateX: botRotateX.interpolate({ inputRange: [0, 180], outputRange: ['180deg', '360deg'] }) }] },
            ]}
          >
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

function EnvelopePocket({ scale, fromName, place }: { scale: number; fromName: string; place: string }) {
  const w = s(v3Layout.envelope.w, scale);
  const h = s(v3Layout.envelope.h, scale);
  const inset = s(v3Layout.envelope.stripeInset, scale);
  return (
    <View style={{ width: w, height: h, borderRadius: s(10, scale), overflow: 'hidden' }}>
      <AirmailStripes scale={scale} w={w} h={h} bg={v3Color.envelopePocket} />
      <View style={{ position: 'absolute', left: inset, right: inset, top: inset, bottom: 0, backgroundColor: v3Color.envelopePocket, borderRadius: s(6, scale) }}>
        <View style={{ position: 'absolute', left: s(16, scale), bottom: s(14, scale), gap: 2 }}>
          <Text style={[styles.mono, { fontSize: s(9, scale), letterSpacing: 1.3 }]}>FROM</Text>
          <Text style={[styles.fromHand, { fontSize: s(22, scale) }]}>{fromName}</Text>
        </View>
        <View style={[styles.postmark, { position: 'absolute', right: s(16, scale), bottom: s(12, scale), width: s(50, scale), height: s(50, scale), borderRadius: s(25, scale), transform: [{ rotate: '-14deg' }] }]}>
          <Text style={[styles.mono, styles.postmarkPlace, { fontSize: s(7.5, scale) }]}>{place}</Text>
        </View>
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
      <View style={[styles.seal, { left: w / 2 - seal / 2, top: s(82, scale), width: seal, height: seal, borderRadius: seal / 2 }]}>
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
        <FlapStripeBars w={w} h={h} period={period} />
      </Svg>
    </View>
  );
}

function FlapStripeBars({ w, h, period }: { w: number; h: number; period: number }) {
  const diag = Math.ceil(Math.sqrt(w * w + h * h)) + period * 2;
  const bars = Math.ceil(diag / period) + 2;
  const cx = w / 2;
  const cy = h / 2;
  return (
    <>
      {Array.from({ length: bars }).map((_, i) => {
        const offset = -diag / 2 + i * period;
        return (
          <Rect
            key={i}
            x={cx + offset}
            y={cy - diag / 2}
            width={period / 2}
            height={diag}
            fill={v3Color.accentBlue}
            clipPath="url(#flapTriangle)"
            transform={`rotate(-45 ${cx + offset + period / 4} ${cy})`}
          />
        );
      })}
    </>
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
  const lineGap = s(33, scale);
  const count = Math.ceil((h - top - bottom) / lineGap) + 1;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: s(24, scale), right: s(24, scale), top, bottom, overflow: 'hidden' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ position: 'absolute', top: i * lineGap, left: 0, right: 0, height: 1, backgroundColor: v3Color.ruleLine }} />
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
  envInside: { position: 'absolute', backgroundColor: v3Color.envelopeInside },
  topHalf: { backgroundColor: v3Color.paper, overflow: 'hidden' },
  botFront: { position: 'absolute', backgroundColor: v3Color.paper, overflow: 'hidden', backfaceVisibility: 'hidden' },
  botBack: { position: 'absolute', backfaceVisibility: 'hidden', overflow: 'hidden', borderBottomLeftRadius: 0 },
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
  seal: { position: 'absolute', backgroundColor: v3Color.accentBlue, alignItems: 'center', justifyContent: 'center' },
});
