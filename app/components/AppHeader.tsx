"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogIn, LogOut, Search, ShieldCheck, UserPlus } from "lucide-react";
import { NotificationBell } from "@/app/components/NotificationBell";
import { useAuth } from "@/app/hooks/useAuth";

type AppHeaderProps = {
  sectionTitle?: string;
  sectionSubtitle?: string;
  tone?: "student" | "admin";
};

export function AppHeader({
  sectionTitle = "Lost & Found",
  sectionSubtitle = "Your school community board",
  tone = "student",
}: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, isAdmin, signOut } = useAuth();
  const Icon = tone === "admin" ? ShieldCheck : Search;

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  const navLinkClass = (href: string) =>
    `inline-flex h-9 items-center rounded-full px-4 text-sm font-700 font-bold transition-all ${
      pathname === href
        ? "bg-[var(--terracotta)] text-white shadow-sm"
        : "text-[var(--ink-soft)] hover:bg-[var(--cream-dark)] hover:text-[var(--ink)]"
    }`;

  return (
    <header
      style={{
        background: "linear-gradient(135deg, #fff9f4 0%, #fdf3ea 100%)",
        borderBottom: "1px solid var(--sand)",
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-md transition-transform group-hover:scale-105"
              style={{
                background: tone === "admin"
                  ? "linear-gradient(135deg, var(--ink) 0%, var(--ink-soft) 100%)"
                  : "linear-gradient(135deg, var(--terracotta) 0%, var(--terra-light) 100%)",
              }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h1
                className="text-xl font-semibold leading-tight"
                style={{ fontFamily: "Lora, serif", color: "var(--ink)" }}
              >
                {sectionTitle}
              </h1>
              <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                {sectionSubtitle}
              </p>
            </div>
          </Link>

          {/* Nav + auth */}
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex flex-wrap items-center gap-1" aria-label="Primary navigation">
              <Link href="/" className={navLinkClass("/")}>
                Student Feed
              </Link>
              {!user || isAdmin ? (
                <Link href="/admin" className={navLinkClass("/admin")}>
                  Admin
                </Link>
              ) : null}
            </nav>

            {user ? (
              <>
                <NotificationBell />
                <div className="hidden min-w-0 text-right md:block">
                  <p
                    className="max-w-48 truncate text-sm font-semibold"
                    style={{ color: "var(--ink)" }}
                  >
                    {user.email}
                  </p>
                  <p className="text-xs capitalize" style={{ color: "var(--ink-muted)" }}>
                    {profile?.role ?? "student"}
                    {profile?.matric_number && (
                      <span
                        className="ml-1.5 font-mono font-bold not-italic"
                        style={{ color: "var(--terracotta)" }}
                      >
                        · {profile.matric_number}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition hover:opacity-80"
                  style={{
                    borderColor: "var(--sand)",
                    background: "#fff",
                    color: "var(--ink-soft)",
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </>
            ) : loading ? null : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition hover:opacity-80"
                  style={{
                    borderColor: "var(--sand)",
                    background: "#fff",
                    color: "var(--ink-soft)",
                  }}
                >
                  <LogIn className="h-4 w-4" />
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white transition hover:opacity-90 shadow-sm"
                  style={{
                    background: "linear-gradient(135deg, var(--terracotta) 0%, var(--terra-light) 100%)",
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
