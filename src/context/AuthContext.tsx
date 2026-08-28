import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

// Lets the in-app browser session close itself and hand control back to the
// app once the OAuth provider redirects — required on native, a no-op on web.
WebBrowser.maybeCompleteAuthSession();

const nativeRedirectTo = makeRedirectUri();

interface AuthResult {
  error: string | null;
}

/** Completes a native OAuth (or magic-link) round trip from the deep-link URL it redirected back to. */
async function createSessionFromUrl(url: string): Promise<AuthResult> {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) return { error: errorCode };
  if (params.error_description) return { error: params.error_description };

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    return { error: error?.message ?? null };
  }
  if (params.access_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    return { error: error?.message ?? null };
  }
  // User backed out of the provider's consent screen before authorizing — not a real error.
  return { error: null };
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** True while the initial session restore from storage is in flight. */
  initializing: boolean;
  signUp: (fullName: string, email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  /**
   * On web, redirects the browser to the provider's login — only resolves
   * (with an error) if that redirect itself fails, e.g. the provider isn't
   * enabled on the Supabase project yet. On native, opens an in-app browser
   * session and resolves once the whole OAuth round trip (including the
   * user actually signing in) completes, fails, or is cancelled.
   */
  signInWithOAuth: (provider: 'facebook' | 'google' | 'apple') => Promise<AuthResult>;
  /** `scope` mirrors Supabase's session scopes: 'local' (this device, default), 'others' (every other device), 'global' (everywhere including this device). */
  signOut: (scope?: 'local' | 'others' | 'global') => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updatePassword: (newPassword: string) => Promise<AuthResult>;
  updateProfileName: (fullName: string) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const NOT_CONFIGURED_ERROR =
  'MySpace isn’t connected to a backend yet — ask the developer to set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setInitializing(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      signUp: async (fullName, email, password) => {
        if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR };
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        return { error: error?.message ?? null };
      },
      signIn: async (email, password) => {
        if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR };
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        return { error: error?.message ?? null };
      },
      signInWithOAuth: async (provider) => {
        if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR };

        // Web: the browser itself carries the redirect back with the
        // session in the URL, same as before.
        if (Platform.OS === 'web') {
          const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
          });
          return { error: error?.message ?? null };
        }

        // Native: there's no browser location to redirect — open the
        // provider's consent screen in an in-app browser session and wait
        // for it to hand back a `myspace://` deep link with the session.
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: nativeRedirectTo, skipBrowserRedirect: true },
        });
        if (error) return { error: error.message };
        if (!data?.url) return { error: 'Could not start sign-in.' };

        const result = await WebBrowser.openAuthSessionAsync(data.url, nativeRedirectTo);
        if (result.type === 'success' && result.url) {
          return createSessionFromUrl(result.url);
        }
        if (result.type === 'cancel' || result.type === 'dismiss') {
          return { error: null };
        }
        return { error: 'Sign-in was interrupted. Please try again.' };
      },
      signOut: async (scope = 'local') => {
        if (!isSupabaseConfigured) return;
        await supabase.auth.signOut({ scope });
      },
      resetPassword: async (email) => {
        if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR };
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        return { error: error?.message ?? null };
      },
      updatePassword: async (newPassword) => {
        if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR };
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        return { error: error?.message ?? null };
      },
      updateProfileName: async (fullName) => {
        if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR };
        const { error } = await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });
        return { error: error?.message ?? null };
      },
    }),
    [session, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
