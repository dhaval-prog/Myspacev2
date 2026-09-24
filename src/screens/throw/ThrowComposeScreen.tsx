import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LetterCanvas } from '../../components/throw/LetterCanvas';
import { throwColor, throwFont, throwSpace } from '../../theme/throwTokens';
import type { StrokePath } from '../../types/throw';

interface ThrowComposeScreenProps {
  recipientName: string;
  recipientCity: string;
  onBack: () => void;
  onDone: (content: { messageText: string | null; strokes: StrokePath[] | null; penColor: string }) => void;
  doneLabel?: string;
}

export function ThrowComposeScreen({ recipientName, recipientCity, onBack, onDone, doneLabel }: ThrowComposeScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backLabel}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>To {recipientName}</Text>
      <Text style={styles.subtitle}>{recipientCity}</Text>

      <View style={{ flex: 1, marginTop: 16 }}>
        <LetterCanvas onDone={onDone} doneLabel={doneLabel ?? 'Preview'} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: throwColor.screenBg, paddingHorizontal: throwSpace.gutter },
  backBtn: { marginBottom: 10 },
  backLabel: { fontFamily: throwFont.ui600, fontSize: 13.5, color: throwColor.inkSoft },
  title: { fontFamily: throwFont.ui700, fontSize: 20, color: throwColor.ink },
  subtitle: { fontFamily: throwFont.ui400, fontSize: 13, color: throwColor.inkSoft, marginTop: 2 },
});
