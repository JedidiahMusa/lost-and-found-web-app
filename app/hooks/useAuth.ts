"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseSetupMessage } from "@/app/lib/supabase";
import type { Profile, ProfileRole } from "@/app/lib/database.types";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isStudent: boolean;
  signIn: (email: string, password: string, expectedRole?: ProfileRole) => Promise<void>;
  signInWithEmailLink: (email: string) => Promise<void>;
  signUp: (email: string, password: string, role?: ProfileRole) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      setProfile(null);
      throw error;
    }

    setProfile(data);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!supabase) {
      setProfile(null);
      return;
    }

    const { data } = await supabase.auth.getSession();
    const currentUser = data.session?.user;

    if (!currentUser) {
      setProfile(null);
      return;
    }

    await loadProfile(currentUser.id);
  }, [loadProfile]);

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    const client = supabase;
    let mounted = true;

    async function boot() {
      setLoading(true);
      const { data, error } = await client.auth.getSession();

      if (error) {
        if (mounted) {
          setSession(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      if (!mounted) return;

      setSession(data.session);

      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      } else {
        setProfile(null);
      }

      if (mounted) setLoading(false);
    }

    boot();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);

      if (nextSession?.user) {
        await loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (email: string, password: string, expectedRole?: ProfileRole) => {
      if (!supabase) throw new Error(supabaseSetupMessage);

      const normalizedEmail = normalizeEmail(email);

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (error) {
        if (error.message.toLowerCase().includes("invalid login credentials")) {
          const { data: isRegistered } = await supabase.rpc("email_is_registered", {
            check_email: normalizedEmail
          });

          if (isRegistered === false) {
            throw new Error("No account was found for this email in the current Supabase project.");
          }

          throw new Error(
            "Supabase rejected this password login. Use Forgot password or Email login link to regain access."
          );
        }

        throw error;
      }

      if (!authData.user) return;

      const { data: nextProfile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !nextProfile) {
        await supabase.auth.signOut();
        throw new Error("Your auth account exists, but no profile row was found. Rerun the Supabase schema SQL.");
      }

      if (expectedRole && nextProfile.role !== expectedRole) {
        await supabase.auth.signOut();
        throw new Error(`This account is registered as ${nextProfile.role}. Choose ${nextProfile.role} login instead.`);
      }

      setSession(authData.session);
      setProfile(nextProfile);
    },
    []
  );

  const signUp = useCallback(async (email: string, password: string, role: ProfileRole = "student") => {
    if (!supabase) throw new Error(supabaseSetupMessage);

    const normalizedEmail = normalizeEmail(email);

    const { data: isRegistered, error: lookupError } = await supabase.rpc("email_is_registered", {
      check_email: normalizedEmail
    });

    if (!lookupError && isRegistered) {
      throw new Error("An account with this email already exists. Log in instead.");
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { role }
      }
    });

    if (error) throw error;

    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw new Error("An account with this email already exists. Log in instead.");
    }
  }, []);

  const signInWithEmailLink = useCallback(async (email: string) => {
    if (!supabase) throw new Error(supabaseSetupMessage);

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizeEmail(email),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/`
      }
    });

    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) throw new Error(supabaseSetupMessage);

    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
      redirectTo: `${window.location.origin}/login`
    });

    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) throw new Error(supabaseSetupMessage);

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setProfile(null);
  }, []);

  return useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isAdmin: profile?.role === "admin",
      isStudent: profile?.role === "student",
      signIn,
      signInWithEmailLink,
      signUp,
      resetPassword,
      signOut,
      refreshProfile
    }),
    [loading, profile, refreshProfile, resetPassword, session, signIn, signInWithEmailLink, signOut, signUp]
  );
}
