import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../components/auth/AuthLayout';
import { AuthField } from '../components/auth/AuthField';
import { AuthButton } from '../components/auth/AuthButton';
import { SocialAuthRow } from '../components/auth/SocialAuthRow';
import { EnvelopeIcon, EyeIcon, EyeOffIcon, LockIcon, PersonIcon } from '../components/auth/icons';

interface SignUpScreenProps {
  onSwitchToLogin: () => void;
}

/** 6c — exact replica of the Create Account reference. */
export function SignUpScreen({ onSwitchToLogin }: SignUpScreenProps) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const iconColor = 'rgba(22,33,12,0.8)';

  const handleSubmit = async () => {
    setError(null);
    setNotice(null);
    if (!fullName.trim()) return setError('Enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');

    setLoading(true);
    const { error: signUpError } = await signUp(fullName, email, password);
    setLoading(false);

    if (signUpError) {
      setError(signUpError);
      return;
    }
    setNotice('Account created — check your email to confirm it, then log in.');
  };

  return (
    <AuthLayout>
      <Text style={typography.authTitle}>Create Account</Text>
      <Text style={[typography.authSubline, styles.subline]}>
        Sign up with your email to save your own space and add people you like.
      </Text>

      <View style={styles.fields}>
        <AuthField
          icon={<PersonIcon color={iconColor} />}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full Name"
          accessibilityLabel="Full name"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
        />
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
          autoComplete="password-new"
          textContentType="newPassword"
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

      {error && <Text style={styles.error}>{error}</Text>}
      {notice && <Text style={styles.notice}>{notice}</Text>}

      <View style={styles.ctaSpacer}>
        <AuthButton label="Create Account" onPress={handleSubmit} loading={loading} />
      </View>

      <Text style={styles.switchText}>
        Already have an account?{' '}
        <Text style={typography.authLink} onPress={onSwitchToLogin}>
          Log In
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
        <Text style={typography.authLink} onPress={() => Linking.openURL('https://myspacev2.vercel.app/terms.html')}>
          Terms of Service
        </Text>{' '}
        and{' '}
        <Text style={typography.authLink} onPress={() => Linking.openURL('https://myspacev2.vercel.app/privacy.html')}>
          Privacy Policy
        </Text>
      </Text>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  subline: { marginTop: spacing.ms },
  fields: { gap: spacing.md, marginTop: spacing.organic },
  ctaSpacer: { marginTop: spacing.huge },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.ms,
    textAlign: 'center',
  },
  notice: {
    ...typography.caption,
    color: colors.textPrimary,
    marginTop: spacing.ms,
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
