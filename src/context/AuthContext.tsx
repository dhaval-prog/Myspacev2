import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

interface AuthResult {
  error: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** True while the initial session restore from storage is in flight. */
  initializing: boolean;
  signUp: (fullName: string, email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  /** Redirects the browser to the provider's login — only resolves (with an error) if that redirect itself fails, e.g. the provider isn't enabled on the Supabase project yet. */
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
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
        });
        return { error: error?.message ?? null };
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
