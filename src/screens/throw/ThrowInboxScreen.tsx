import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LetterCard } from '../../components/throw/LetterCard';
import { throwColor, throwFont, throwSpace } from '../../theme/throwTokens';
import { useThrow } from '../../context/ThrowContext';

interface ThrowInboxScreenProps {
  onBack: () => void;
  onOpenLetter: (throwId: string) => void;
}

export function ThrowInboxScreen({ onBack, onOpenLetter }: ThrowInboxScreenProps) {
  const insets = useSafeAreaInsets();
  const { letters, deleteThrow } = useThrow();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (throwId: string) => {
    setError(null);
    const { error: err } = await deleteThrow(throwId);
    if (err) setError(err);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backLabel}>‹ Back to map</Text>
      </Pressable>
      <Text style={styles.title}>Throw Inbox</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={letters}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ paddingTop: 14 }}
        renderItem={({ item }) => <LetterCard letter={item} onPress={() => onOpenLetter(item.id)} onDelete={() => handleDelete(item.id)} />}
        ListEmptyComponent={<Text style={styles.empty}>No letters yet — throw one to start your collection.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: throwColor.screenBg, paddingHorizontal: throwSpace.gutter },
  backBtn: { marginBottom: 10 },
  backLabel: { fontFamily: throwFont.ui600, fontSize: 13.5, color: throwColor.inkSoft },
  title: { fontFamily: throwFont.hand700, fontSize: 28, color: throwColor.ink },
  error: { fontFamily: throwFont.ui400, fontSize: 12.5, color: '#B3413A', marginTop: 8 },
  empty: { fontFamily: throwFont.ui400, fontSize: 13.5, color: throwColor.inkMute, textAlign: 'center', marginTop: 40 },
});
