import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Shared chrome for Sign Up / Log In: the soft welcoming gradient (distinct
 * from the flat lime used everywhere else in the app) and a keyboard-safe
 * scroll area.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
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
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.huge, paddingBottom: insets.bottom + spacing.md }]}
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxxl,
  },
});
