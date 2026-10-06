import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { fontFamily } from '../../theme';

const STRIPE_BLUE = '#2F6BFF';
const CREAM = '#F6F1E6';
// react-native-svg's web typings omit `children` on Defs/Pattern (a typing gap, not a runtime
// issue) — cast once, same as FriendsGlow's own DefsAny.
const DefsAny = Defs as unknown as React.ComponentType<{ children?: React.ReactNode }>;
const PatternAny = Pattern as unknown as React.ComponentType<{ children?: React.ReactNode } & Record<string, unknown>>;

/** The handoff's repeating-linear-gradient(135deg,#2F6BFF 0 8px,#F6F1E6 8px 16px) airmail stripe —
 * RN has no repeating-gradient primitive, so this tiles two rects through an SVG pattern instead. */
function AirmailStripe() {
  return (
    <Svg style={[styles.stripeSvg]} width="100%" height="100%">
      <DefsAny>
        <PatternAny id="airmailStripe" width={22.6} height={22.6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <Rect x={0} y={0} width={22.6} height={11.3} fill={STRIPE_BLUE} />
          <Rect x={0} y={11.3} width={22.6} height={11.3} fill={CREAM} />
        </PatternAny>
      </DefsAny>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#airmailStripe)" />
    </Svg>
  );
}

/**
 * The airmail "letter card" group messages carry a Throw letter as — the MySpace Chats Throw
 * handoff's own blue/cream diagonal-stripe border, Caveat title, dashed postmark place tag, and
 * "Break seal" button. Identical in day and night (the handoff never themes it), so there's no
 * isDay variant here.
 */
export function GroupLetterCard({
  title,
  place,
  groupName,
  timeLabel,
  onBreakSeal,
}: {
  title: string;
  place: string | null;
  groupName: string;
  timeLabel: string;
  onBreakSeal: () => void;
}) {
  return (
    <View style={styles.stripeFrame}>
      <AirmailStripe />
      <View style={styles.inner}>
        <View style={styles.topRow}>
          <View style={styles.topText}>
            <Text style={styles.kicker}>PAR AVION · TO {groupName.toUpperCase()}</Text>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          </View>
          {place ? (
            <View style={styles.postmark}>
              <Text style={styles.postmarkText} numberOfLines={1}>
                {place}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.bottomRow}>
          <Text style={styles.time}>{timeLabel}</Text>
          <Pressable onPress={onBreakSeal} style={styles.breakSeal} accessibilityRole="button" accessibilityLabel="Break seal">
            <View style={styles.breakSealDot} />
            <Text style={styles.breakSealText}>Break seal</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stripeSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  stripeFrame: {
    width: 236,
    borderRadius: 18,
    borderBottomLeftRadius: 7,
    padding: 5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
  },
  inner: {
    borderRadius: 13,
    borderBottomLeftRadius: 4,
    backgroundColor: CREAM,
    padding: 12,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  topText: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    fontFamily: fontFamily.mono500,
    fontSize: 8.5,
    letterSpacing: 1,
    color: '#8A8A8A',
  },
  title: {
    fontFamily: 'Caveat_600SemiBold',
    fontSize: 22,
    lineHeight: 24,
    color: '#2346C8',
  },
  postmark: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(47,107,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-12deg' }],
    flexShrink: 0,
  },
  postmarkText: {
    fontFamily: fontFamily.mono500,
    fontSize: 6.5,
    color: STRIPE_BLUE,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  time: {
    fontFamily: fontFamily.mono500,
    fontSize: 10.5,
    color: '#8A8A8A',
  },
  breakSeal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: STRIPE_BLUE,
  },
  breakSealDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    opacity: 0.9,
  },
  breakSealText: {
    fontFamily: fontFamily.sans700,
    fontSize: 12,
    color: '#FFFFFF',
  },
});
