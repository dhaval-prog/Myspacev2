import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ContactLocationCard } from '../../components/throw/ContactLocationCard';
import { throwColor, throwFont, throwSpace } from '../../theme/throwTokens';
import { useThrow } from '../../context/ThrowContext';

interface ThrowContactPickerScreenProps {
  onBack: () => void;
  onSelect: (friendUserId: string) => void;
}

export function ThrowContactPickerScreen({ onBack, onSelect }: ThrowContactPickerScreenProps) {
  const insets = useSafeAreaInsets();
  const { friends, myLocation } = useThrow();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backLabel}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Where do you want to throw this?</Text>

      <FlatList
        data={friends}
        keyExtractor={(f) => f.userId}
        contentContainerStyle={{ paddingTop: 12 }}
        renderItem={({ item }) => <ContactLocationCard friend={item} myLocation={myLocation} onPress={() => onSelect(item.userId)} />}
        ListEmptyComponent={<Text style={styles.empty}>Add friends in Orbit to start throwing letters.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: throwColor.screenBg, paddingHorizontal: throwSpace.gutter },
  backBtn: { marginBottom: 12 },
  backLabel: { fontFamily: throwFont.ui600, fontSize: 13.5, color: throwColor.inkSoft },
  title: { fontFamily: throwFont.ui700, fontSize: 20, color: throwColor.ink },
  empty: { fontFamily: throwFont.ui400, fontSize: 13.5, color: throwColor.inkMute, textAlign: 'center', marginTop: 30 },
});
