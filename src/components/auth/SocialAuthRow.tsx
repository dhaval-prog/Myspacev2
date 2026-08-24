import React from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../../theme';
import { AppleIcon, FacebookIcon, GoogleIcon } from './icons';

const PROVIDERS = [
  { id: 'facebook', label: 'Continue with Facebook', bg: colors.white, render: () => <FacebookIcon /> },
  { id: 'google', label: 'Continue with Google', bg: colors.white, render: () => <GoogleIcon /> },
  { id: 'apple', label: 'Continue with Apple', bg: colors.ink, render: () => <AppleIcon /> },
] as const;

/**
 * Facebook / Google / Apple sign-in. No OAuth provider is configured on the
 * Supabase project yet, so these are wired but surface that plainly rather
 * than silently failing — swap the alert for a real signInWithOAuth call
 * once the providers are set up in the Supabase dashboard.
 */
export function SocialAuthRow() {
  const handlePress = (label: string) => {
    Alert.alert('Not set up yet', `${label} isn't configured on this project yet.`);
  };

  return (
    <View style={styles.row}>
      {PROVIDERS.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => handlePress(p.label)}
          accessibilityRole="button"
          accessibilityLabel={p.label}
          style={({ pressed }) => [styles.button, { backgroundColor: p.bg }, pressed && styles.buttonPressed]}
        >
          {p.render()}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  button: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 2,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
