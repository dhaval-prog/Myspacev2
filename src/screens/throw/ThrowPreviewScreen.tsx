import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThrowButton } from '../../components/throw/ThrowButton';
import { throwColor, throwFont, throwRadius, throwSpace } from '../../theme/throwTokens';
import { formatMiles } from '../../utils/geo';
import type { StrokePath } from '../../types/throw';

interface ThrowPreviewScreenProps {
  recipientName: string;
  recipientCity: string;
  recipientCountry: string;
  distanceMiles: number;
  content: { messageText: string | null; strokes: StrokePath[] | null };
  onBack: () => void;
  onThrow: () => Promise<{ error: string | null }>;
  throwLabel?: string;
}

function strokeToPathD(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

export function ThrowPreviewScreen({
  recipientName,
  recipientCity,
  recipientCountry,
  distanceMiles,
  content,
  onBack,
  onThrow,
  throwLabel = 'THROW',
}: ThrowPreviewScreenProps) {
  const insets = useSafeAreaInsets();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleThrow = async () => {
    setSending(true);
    setError(null);
    const { error: err } = await onThrow();
    if (err) {
      setError(err);
      setSending(false);
    }
    // On success the parent navigates away (to the flight screen) — no need to reset `sending`.
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
      <Pressable onPress={onBack} style={styles.backBtn} disabled={sending}>
        <Text style={styles.backLabel}>‹ Back to writing</Text>
      </Pressable>

      <View style={styles.paper}>
        {content.strokes ? (
          <Svg width="100%" height="100%" viewBox="0 0 340 260" preserveAspectRatio="xMidYMid meet">
            {content.strokes.map((s, i) => (
              <Path key={i} d={strokeToPathD(s.points)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </Svg>
        ) : (
          <Text style={styles.typedPreview}>{content.messageText}</Text>
        )}
      </View>

      <View style={styles.meta}>
        <Text style={styles.metaLabel}>To</Text>
        <Text style={styles.metaValue}>{recipientName}</Text>
        <Text style={styles.metaSub}>
          {recipientCity}, {recipientCountry}
        </Text>
        <Text style={styles.distance}>{formatMiles(distanceMiles)} away</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <ThrowButton onPress={handleThrow} disabled={sending}>
        {sending ? 'Throwing…' : throwLabel}
      </ThrowButton>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: throwColor.screenBg, paddingHorizontal: throwSpace.gutter },
  backBtn: { marginBottom: 12 },
  backLabel: { fontFamily: throwFont.ui600, fontSize: 13.5, color: throwColor.inkSoft },
  paper: {
    height: 260,
    backgroundColor: throwColor.paper,
    borderRadius: throwRadius.paper,
    borderWidth: 1,
    borderColor: throwColor.paperLine,
    padding: 18,
    ...throwColor.shadowSoft,
  },
  typedPreview: { fontFamily: throwFont.hand500, fontSize: 22, color: throwColor.ink, lineHeight: 30 },
  meta: { alignItems: 'center', marginTop: 22, marginBottom: 22 },
  metaLabel: { fontFamily: throwFont.ui600, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: throwColor.inkMute },
  metaValue: { fontFamily: throwFont.ui700, fontSize: 20, color: throwColor.ink, marginTop: 4 },
  metaSub: { fontFamily: throwFont.ui400, fontSize: 13.5, color: throwColor.inkSoft, marginTop: 2 },
  distance: { fontFamily: throwFont.mono500, fontSize: 13, color: throwColor.clayDeep, marginTop: 10 },
  error: { fontFamily: throwFont.ui400, fontSize: 12.5, color: '#B3413A', textAlign: 'center', marginBottom: 10 },
});
