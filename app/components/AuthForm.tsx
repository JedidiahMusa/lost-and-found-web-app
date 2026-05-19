"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { LogIn, UserPlus, Search } from "lucide-react";
import { useAuth } from "@/app/hooks/useAuth";
import type { ProfileRole } from "@/app/lib/database.types";
import { isSupabaseConfigured, supabaseSetupMessage } from "@/app/lib/supabase";

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { user, loading, isAdmin, signIn, signInWithEmailLink, signUp, resetPassword } = useAuth();

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [loginRole, setLoginRole]   = useState<ProfileRole>("student");
  const [signupRole, setSignupRole] = useState<ProfileRole>("student");
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting]   = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [message, setMessage]       = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  const isLogin         = mode === "login";
  const normalizedEmail = email.trim().toLowerCase();

  // Redirect after login
  useEffect(() => {
    if (loading || !user) return;
    router.replace(isAdmin ? "/admin" : "/");
  }, [isAdmin, loading, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true); setError(null); setMessage(null);

    try {
      if (isLogin) {
        await signIn(normalizedEmail, password, loginRole);
        setMessage("Signed in! Redirecting…");
      } else {
        // Validate matric number for students before calling signUp
        if (signupRole === "student" && !matricNumber.trim()) {
          throw new Error("Matric number is required for student accounts.");
        }
        await signUp(
          normalizedEmail,
          password,
          signupRole,
          signupRole === "student" ? matricNumber.trim() : undefined,
        );
        setMessage("Account created! Check your email if confirmation is enabled, then log in.");
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordReset() {
    if (!normalizedEmail) { setError("Enter your email first, then request a reset."); return; }
    setResetting(true); setError(null); setMessage(null);
    try {
      await resetPassword(normalizedEmail);
      setMessage("Password reset email sent if this account exists.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send password reset.");
    } finally { setResetting(false); }
  }

  async function handleEmailLinkLogin() {
    if (!normalizedEmail) { setError("Enter your email first."); return; }
    setSendingLink(true); setError(null); setMessage(null);
    try {
      await signInWithEmailLink(normalizedEmail);
      setMessage("Login link sent — open it from your email.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send login link.");
    } finally { setSendingLink(false); }
  }

  const roles: ProfileRole[]                   = ["student", "admin"];
  const roleEmojis: Record<ProfileRole, string> = { student: "🎒", admin: "🛡️" };
  const activeRole = isLogin ? loginRole : signupRole;
  const setRole    = isLogin ? setLoginRole : setSignupRole;

  const inputStyle: React.CSSProperties = {
    borderColor: "var(--sand)",
    background:  "var(--cream)",
    color:       "var(--ink)",
    fontFamily:  "Nunito, sans-serif",
  };

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--cream)" }}>
      {/* Decorative top bar */}
      <div className="h-1.5 w-full"
        style={{ background: "linear-gradient(90deg, var(--terracotta), var(--terra-light), var(--amber))" }} />

      {/* Back link */}
      <div className="mx-auto w-full max-w-md px-4 pt-6">
        <Link href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-70"
          style={{ color: "var(--ink-muted)" }}>
          <Search className="h-3.5 w-3.5" />
          Back to Lost &amp; Found
        </Link>
      </div>

      {/* Card */}
      <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
        <div className="overflow-hidden"
          style={{
            background: "#fff", borderRadius: 24,
            boxShadow: "0 4px 32px rgba(44,26,14,0.10), 0 0 0 1.5px var(--sand)",
          }}>

          {/* Card header */}
          <div className="px-6 pt-7 pb-5 border-b"
            style={{ background: "linear-gradient(135deg, #fff9f4 0%, #fdf3ea 100%)", borderColor: "var(--cream-dark)" }}>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md"
                style={{ background: "linear-gradient(135deg, var(--terracotta) 0%, var(--terra-light) 100%)" }}>
                {isLogin ? <LogIn className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
              </div>
              <div>
                <h1 className="text-xl font-semibold leading-tight"
                  style={{ fontFamily: "Lora, serif", color: "var(--ink)" }}>
                  {isLogin ? "Welcome back 👋" : "Join the community"}
                </h1>
                <p className="text-sm mt-0.5" style={{ color: "var(--ink-muted)" }}>
                  {isLogin
                    ? "Log in to your account below."
                    : "Create an account to post and claim items."}
                </p>
              </div>
            </div>
          </div>

          {/* Card body */}
          <div className="px-6 py-6">
            {!isSupabaseConfigured ? (
              <p className="rounded-2xl px-4 py-3 text-sm font-medium"
                style={{ background: "var(--amber-pale)", color: "#92400e" }}>
                {supabaseSetupMessage}
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Role selector */}
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--ink-muted)" }}>
                    {isLogin ? "Sign in as" : "Joining as"}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 rounded-2xl p-1.5" style={{ background: "var(--cream-dark)" }}>
                    {roles.map((role) => {
                      const selected = activeRole === role;
                      return (
                        <button key={role} type="button" onClick={() => setRole(role)}
                          className="h-10 rounded-xl text-sm font-bold capitalize transition-all"
                          style={{
                            background: selected ? "#fff" : "transparent",
                            color:      selected ? "var(--ink)" : "var(--ink-muted)",
                            boxShadow:  selected ? "var(--shadow-card)" : "none",
                          }}>
                          {roleEmojis[role]} {role}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Matric number — students on signup only */}
                {!isLogin && signupRole === "student" && (
                  <label className="block">
                    <span className="mb-1.5 flex items-center justify-between text-sm font-bold"
                      style={{ color: "var(--ink-soft)" }}>
                      Matric Number
                      <span className="text-xs font-normal rounded-full px-2 py-0.5"
                        style={{ background: "var(--terra-pale)", color: "var(--terracotta)" }}>
                        Required for students
                      </span>
                    </span>
                    <input
                      type="text"
                      value={matricNumber}
                      onChange={(e) => setMatricNumber(e.target.value.toUpperCase())}
                      required
                      maxLength={20}
                      autoComplete="off"
                      placeholder="e.g. CSC/2021/001"
                      className="h-11 w-full rounded-xl border px-3.5 text-sm font-mono outline-none transition"
                      style={{
                        ...inputStyle,
                        letterSpacing: "0.05em",
                        borderColor: matricNumber.trim() ? "var(--moss)" : "var(--sand)",
                      }}
                    />
                    <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                      This will be shown alongside your name on posts. Must be unique.
                    </p>
                  </label>
                )}

                {/* Email */}
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold" style={{ color: "var(--ink-soft)" }}>
                    Email
                  </span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    required autoComplete="email" placeholder="you@school.edu"
                    className="h-11 w-full rounded-xl border px-3.5 text-sm outline-none transition"
                    style={inputStyle}
                  />
                </label>

                {/* Password */}
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold" style={{ color: "var(--ink-soft)" }}>
                    Password
                  </span>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    required minLength={6}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    placeholder={isLogin ? "Your password" : "Min. 6 characters"}
                    className="h-11 w-full rounded-xl border px-3.5 text-sm outline-none transition"
                    style={inputStyle}
                  />
                </label>

                {/* Submit */}
                <button type="submit" disabled={submitting}
                  className="h-12 w-full rounded-xl text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, var(--terracotta) 0%, var(--terra-light) 100%)" }}>
                  {submitting ? "Working…" : isLogin ? "Log in →" : "Create account →"}
                </button>

                {/* Login-only extras */}
                {isLogin && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={handleEmailLinkLogin} disabled={sendingLink}
                      className="h-10 rounded-xl border text-sm font-semibold transition hover:opacity-70 disabled:opacity-40"
                      style={{ borderColor: "var(--sand)", color: "var(--ink-soft)", background: "#fff" }}>
                      {sendingLink ? "Sending…" : "✉️ Email link"}
                    </button>
                    <button type="button" onClick={handlePasswordReset} disabled={resetting}
                      className="h-10 rounded-xl border text-sm font-semibold transition hover:opacity-70 disabled:opacity-40"
                      style={{ borderColor: "var(--sand)", color: "var(--ink-soft)", background: "#fff" }}>
                      {resetting ? "Sending…" : "🔑 Forgot password?"}
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* Feedback */}
            {message && (
              <p className="mt-4 rounded-xl p-3 text-sm font-semibold"
                style={{ background: "var(--moss-pale)", color: "var(--moss)" }}>
                {message}
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-xl p-3 text-sm font-semibold"
                style={{ background: "var(--rose-pale)", color: "var(--rose-warm)" }}>
                {error}
              </p>
            )}

            {/* Switch mode */}
            <div className="mt-6 pt-5 border-t text-center text-sm" style={{ borderColor: "var(--cream-dark)" }}>
              <span style={{ color: "var(--ink-muted)" }}>
                {isLogin ? "Don't have an account? " : "Already have an account? "}
              </span>
              <Link href={isLogin ? "/signup" : "/login"}
                className="font-bold transition hover:opacity-70"
                style={{ color: "var(--terracotta)" }}>
                {isLogin ? "Sign up" : "Log in"}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
