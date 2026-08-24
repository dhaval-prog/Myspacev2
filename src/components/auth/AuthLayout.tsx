import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';

interface AuthLayoutProps {
  onBack: () => void;
  children: React.ReactNode;
}

/**
 * Shared chrome for Sign Up / Log In: the soft welcoming gradient (distinct
 * from the flat lime used everywhere else in the app), a floating back
 * button, and a keyboard-safe scroll area.
 */
export function AuthLayout({ onBack, children }: AuthLayoutProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={colors.authGradient as [string, string, ...string[]]}
      locations={colors.authGradientStops as [number, number, ...number[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.fill}
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <Text style={styles.backGlyph}>←</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.md }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xxxl,
  },
  backButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
  },
  backButtonPressed: {
    opacity: 0.85,
  },
  backGlyph: {
    fontSize: 21,
    color: colors.textPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxxl,
  },
});
