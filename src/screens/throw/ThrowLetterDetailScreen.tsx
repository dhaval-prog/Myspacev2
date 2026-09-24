import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThrowButton } from '../../components/throw/ThrowButton';
import { throwColor, throwFont, throwRadius, throwSpace } from '../../theme/throwTokens';
import { formatMiles } from '../../utils/geo';
import { useThrow } from '../../context/ThrowContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface ThrowLetterDetailScreenProps {
  throwId: string;
  onBack: () => void;
  onThrowBack: (counterpartUserId: string, repliedToThrowId: string) => void;
}

function strokeToPathD(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

export function ThrowLetterDetailScreen({ throwId, onBack, onThrowBack }: ThrowLetterDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { letters, markRead } = useThrow();
  const letter = letters.find((l) => l.id === throwId);

  const unfold = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (letter && letter.direction === 'received' && letter.status === 'thrown') {
      markRead(letter.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter?.id]);

  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(unfold, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [reduceMotion, unfold]);

  if (!letter) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 20 }]}>
        <Pressable onPress={onBack}>
          <Text style={styles.backLabel}>‹ Back</Text>
        </Pressable>
      </View>
    );
  }

  const opacity = unfold;
  const scale = unfold.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const fromCity = letter.direction === 'sent' ? letter.recipientCity : letter.senderCity;
  const fromCountry = letter.direction === 'sent' ? letter.recipientCountry : letter.senderCountry;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20 }]}>
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backLabel}>‹ Back to inbox</Text>
      </Pressable>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity, transform: [{ scale }] }}>
          <Text style={styles.headerLabel}>{letter.direction === 'sent' ? `To ${letter.counterpartName}` : `From ${letter.counterpartName}`}</Text>
          <Text style={styles.headerRoute}>
            {letter.senderCity} → {letter.recipientCity}
          </Text>
          <Text style={styles.headerDistance}>{formatMiles(letter.distanceMiles)}</Text>

          <View style={styles.paper}>
            {letter.strokes ? (
              <Svg width="100%" height="100%" viewBox="0 0 340 300" preserveAspectRatio="xMidYMid meet">
                {letter.strokes.map((s, i) => (
                  <Path key={i} d={strokeToPathD(s.points)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </Svg>
            ) : (
              <Text style={styles.typedText}>{letter.messageText}</Text>
            )}
          </View>
        </Animated.View>

        <View style={{ flex: 1, minHeight: 24 }} />

        {letter.direction === 'received' && (
          <ThrowButton onPress={() => onThrowBack(letter.counterpartId, letter.id)}>Throw Back</ThrowButton>
        )}
        {letter.direction === 'sent' && <Text style={styles.sentNote}>Thrown to {fromCity}, {fromCountry}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: throwColor.screenBg, paddingHorizontal: throwSpace.gutter },
  backBtn: { marginBottom: 14 },
  backLabel: { fontFamily: throwFont.ui600, fontSize: 13.5, color: throwColor.inkSoft },
  headerLabel: { fontFamily: throwFont.ui700, fontSize: 18, color: throwColor.ink },
  headerRoute: { fontFamily: throwFont.ui400, fontSize: 12.5, color: throwColor.inkSoft, marginTop: 3 },
  headerDistance: { fontFamily: throwFont.mono500, fontSize: 11.5, color: throwColor.clayDeep, marginTop: 4, marginBottom: 16 },
  paper: {
    height: 300,
    backgroundColor: throwColor.paper,
    borderRadius: throwRadius.paper,
    borderWidth: 1,
    borderColor: throwColor.paperLine,
    padding: 18,
    ...throwColor.shadowSoft,
  },
  typedText: { fontFamily: throwFont.hand500, fontSize: 22, color: throwColor.ink, lineHeight: 30 },
  sentNote: { fontFamily: throwFont.ui400, fontSize: 12.5, color: throwColor.inkMute, textAlign: 'center', marginBottom: 8 },
});
