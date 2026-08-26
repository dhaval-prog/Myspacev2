import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../components/auth/AuthLayout';
import { AuthField } from '../components/auth/AuthField';
import { AuthButton } from '../components/auth/AuthButton';
import { SocialAuthRow } from '../components/auth/SocialAuthRow';
import { EnvelopeIcon, EyeIcon, EyeOffIcon, LockIcon } from '../components/auth/icons';

interface LoginScreenProps {
  onSwitchToSignUp: () => void;
}

/** 6d — exact replica of the Welcome Back reference. */
export function LoginScreen({ onSwitchToSignUp }: LoginScreenProps) {
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const iconColor = 'rgba(22,33,12,0.8)';

  const handleSubmit = async () => {
    setError(null);
    setNotice(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (!password) return setError('Enter your password.');

    setLoading(true);
    const { error: signInError } = await signIn(email, password);
    setLoading(false);
    if (signInError) setError(signInError);
  };

  const handleForgotPassword = async () => {
    setError(null);
    setNotice(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter your email above first, then tap Forgot Password.');
      return;
    }
    setResetting(true);
    const { error: resetError } = await resetPassword(email);
    setResetting(false);
    if (resetError) setError(resetError);
    else setNotice(`Password reset link sent to ${email.trim()}.`);
  };

  return (
    <AuthLayout onBack={onSwitchToSignUp}>
      <View style={styles.spacer62} />
      <Text style={typography.authTitle}>Welcome Back</Text>
      <Text style={[typography.authSubline, styles.subline]}>
        Sign in with your email to reach your rooms, your things, and everything you saved.
      </Text>

      <View style={styles.fields}>
        <AuthField
          icon={<EnvelopeIcon color={iconColor} />}
          value={email}
          onChangeText={setEmail}
          placeholder="Email Address"
          accessibilityLabel="Email address"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <AuthField
          icon={<LockIcon color={iconColor} />}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          accessibilityLabel="Password"
          secureTextEntry={!showPassword}
          autoComplete="password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          rightAccessory={
            <Pressable
              onPress={() => setShowPassword((s) => !s)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              hitSlop={8}
            >
              {showPassword ? <EyeIcon color={iconColor} /> : <EyeOffIcon color={iconColor} />}
            </Pressable>
          }
        />
      </View>

      <Pressable
        onPress={handleForgotPassword}
        disabled={resetting}
        accessibilityRole="button"
        accessibilityLabel="Forgot password"
        style={styles.forgotButton}
      >
        <Text style={[typography.authForgot, resetting && styles.forgotDisabled]}>
          {resetting ? 'Sending…' : 'Forgot Password'}
        </Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
      {notice && <Text style={styles.notice}>{notice}</Text>}

      <View style={styles.ctaSpacer}>
        <AuthButton label="Log In" onPress={handleSubmit} loading={loading} />
      </View>

      <Text style={styles.switchText}>
        Don't have an account?{' '}
        <Text style={typography.authLink} onPress={onSwitchToSignUp}>
          Sign Up
        </Text>
      </Text>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={typography.authDivider}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.socialSpacer}>
        <SocialAuthRow
          onError={(message) => {
            setNotice(null);
            setError(message);
          }}
        />
      </View>

      <View style={styles.flexSpacer} />

      <Text style={styles.footer}>
        By continuing to use MySpace, you agree to our{'\n'}
        <Text style={typography.authLink}>Terms of Service</Text> and{' '}
        <Text style={typography.authLink}>Privacy Policy</Text>
      </Text>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  spacer62: { height: 62 },
  subline: { marginTop: spacing.ms },
  fields: { gap: spacing.md, marginTop: 40 },
  forgotButton: { alignSelf: 'flex-end', marginTop: spacing.md },
  forgotDisabled: { opacity: 0.6 },
  ctaSpacer: { marginTop: spacing.xxxl },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  notice: {
    ...typography.caption,
    color: colors.textPrimary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  switchText: {
    ...typography.authFooter,
    fontSize: 14,
    marginTop: spacing.xl,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxxl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(22,33,12,0.14)',
  },
  socialSpacer: { marginTop: spacing.huge },
  flexSpacer: { flex: 1, minHeight: spacing.huge },
  footer: { marginBottom: spacing.sm, ...typography.authFooter },
});
