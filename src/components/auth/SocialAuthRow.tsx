import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { GoogleIcon } from './icons';

interface SocialAuthRowProps {
  /** Surfaces a failed OAuth redirect (e.g. the provider isn't enabled on the Supabase project yet) — the caller renders it the same way as its own form errors. */
  onError: (message: string) => void;
}

/** Google sign-in — redirects via Supabase OAuth. Facebook and Apple were removed while their own developer-account setup is still pending. */
export function SocialAuthRow({ onError }: SocialAuthRowProps) {
  const { signInWithOAuth } = useAuth();
  const [pending, setPending] = useState(false);

  const handlePress = async () => {
    if (pending) return;
    setPending(true);
    const { error } = await signInWithOAuth('google');
    // On success the browser is already navigating away; only a failure to
    // even start that redirect (e.g. provider not enabled) resolves here.
    if (error) {
      onError(error);
      setPending(false);
    }
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={handlePress}
        disabled={pending}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, pending && styles.buttonDisabled]}
      >
        <GoogleIcon />
      </Pressable>
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
    backgroundColor: colors.white,
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
