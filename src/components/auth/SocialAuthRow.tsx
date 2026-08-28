import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../ConfirmDialog';
import { AppleIcon, FacebookIcon, GoogleIcon } from './icons';

const PROVIDERS = [
  { id: 'facebook', label: 'Continue with Facebook', bg: colors.white, render: () => <FacebookIcon /> },
  { id: 'google', label: 'Continue with Google', bg: colors.white, render: () => <GoogleIcon /> },
  { id: 'apple', label: 'Continue with Apple', bg: colors.ink, render: () => <AppleIcon /> },
] as const;

// Facebook and Apple sign-in are still mid-setup (pending Facebook App Review
// and an Apple Developer account) — tapping them explains that instead of
// attempting a real OAuth redirect.
const COMING_SOON: Partial<Record<(typeof PROVIDERS)[number]['id'], string>> = {
  facebook: 'Facebook',
  apple: 'Apple',
};

interface SocialAuthRowProps {
  /** Surfaces a failed OAuth redirect (e.g. the provider isn't enabled on the Supabase project yet) — the caller renders it the same way as its own form errors. */
  onError: (message: string) => void;
}

/** Facebook / Google / Apple sign-in — redirects to the provider via Supabase OAuth. */
export function SocialAuthRow({ onError }: SocialAuthRowProps) {
  const { signInWithOAuth } = useAuth();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  const handlePress = async (id: (typeof PROVIDERS)[number]['id']) => {
    if (pendingId) return;
    const providerName = COMING_SOON[id];
    if (providerName) {
      setComingSoon(providerName);
      return;
    }
    setPendingId(id);
    const { error } = await signInWithOAuth(id);
    // On success the browser is already navigating away; only a failure to
    // even start that redirect (e.g. provider not enabled) resolves here.
    if (error) {
      onError(error);
      setPendingId(null);
    }
  };

  return (
    <View style={styles.row}>
      {PROVIDERS.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => handlePress(p.id)}
          disabled={pendingId !== null}
          accessibilityRole="button"
          accessibilityLabel={p.label}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: p.bg },
            pressed && styles.buttonPressed,
            pendingId !== null && pendingId !== p.id && styles.buttonDisabled,
          ]}
        >
          {p.render()}
        </Pressable>
      ))}
      <ConfirmDialog
        visible={comingSoon !== null}
        title="Coming soon"
        message={`Sign in with ${comingSoon} will be enabled once the app is live on the App Store.`}
        confirmLabel="Got it"
        hideCancel
        onConfirm={() => setComingSoon(null)}
        onCancel={() => setComingSoon(null)}
      />
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
  buttonDisabled: {
    opacity: 0.4,
  },
});
