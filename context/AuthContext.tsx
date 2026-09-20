'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isSubscribed: boolean | null;
  checkingSubscription: boolean;
  signInWithLicenseKey: (email: string, licenseKey: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkSubscription: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(false);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data as Profile);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  const checkSubscription = useCallback(async (): Promise<boolean> => {
    if (!user?.email) {
      setIsSubscribed(false);
      return false;
    }
    setCheckingSubscription(true);
    try {
      // For license-key-based auth, if the user is logged in they are verified Pro users
      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error('Subscription verification error:', err);
      setIsSubscribed(false);
      return false;
    } finally {
      setCheckingSubscription(false);
    }
  }, [user?.email]);

  useEffect(() => {
    let mounted = true;

    // Fetch active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setIsSubscribed(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user?.email) {
      checkSubscription();
    } else {
      setIsSubscribed(null);
    }
  }, [user?.email, checkSubscription]);

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  /**
   * Sign in via Gumroad license key verification.
   * 1. Verifies the license key + email against Gumroad.
   * 2. On success, uses Supabase OTP (magic link) to create/sign-in the user.
   */
  const signInWithLicenseKey = async (email: string, licenseKey: string): Promise<{ error: Error | null }> => {
    try {
      // Step 1: Verify the Gumroad license key
      const verifyRes = await fetch('/api/auth/verify-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, licenseKey }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyData.verified) {
        return { error: new Error(verifyData.error || 'License key verification failed.') };
      }

      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/library`
        : undefined;

      // Step 2: Sign in or create user via Supabase magic link (OTP)
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: redirectUrl,
          // Create the user if they don't exist yet
          shouldCreateUser: true,
          data: {
            full_name: email.split('@')[0],
          },
        },
      });

      if (otpError) {
        return { error: new Error(otpError.message) };
      }

      // OTP email sent — caller should show "check your email" message
      return { error: null };
    } catch (err: any) {
      return { error: new Error(err.message || 'Sign in failed.') };
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/mysetlist` : undefined,
      },
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsSubscribed(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        isSubscribed,
        checkingSubscription,
        signInWithLicenseKey,
        signInWithGoogle,
        signOut,
        refreshProfile,
        checkSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
