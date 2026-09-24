import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { throwColor, throwFont, throwGradient, throwRadius } from '../../theme/throwTokens';

interface ThrowButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  sub?: string;
}

/** The large primary "THROW" / "THROW BACK" action — a quiet warm gradient, never a bright CTA. */
export function ThrowButton({ children, onPress, disabled, sub }: ThrowButtonProps) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <View style={[styles.wrap, disabled && styles.disabled]}>
        {!disabled && (
          <LinearGradient
            colors={throwGradient.throwBtn.colors}
            locations={throwGradient.throwBtn.locations}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Text style={[styles.label, disabled && styles.labelDisabled]}>{children}</Text>
        {sub ? <Text style={[styles.sub, disabled && styles.labelDisabled]}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 58,
    borderRadius: throwRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  disabled: { backgroundColor: throwColor.paperLine },
  label: { fontFamily: throwFont.ui700, fontSize: 16, letterSpacing: 1.2, color: '#fff' },
  labelDisabled: { color: throwColor.inkFaint },
  sub: { fontFamily: throwFont.ui400, fontSize: 11, color: 'rgba(255,255,255,.85)', marginTop: 2 },
});
