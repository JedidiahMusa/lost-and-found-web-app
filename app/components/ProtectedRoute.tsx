"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/app/hooks/useAuth";
import type { ProfileRole } from "@/app/lib/database.types";
import { isSupabaseConfigured, supabaseSetupMessage } from "@/app/lib/supabase";

type ProtectedRouteProps = {
  children: ReactNode;
  role?: ProfileRole;
};

export function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const router = useRouter();
  const { loading, user, profile } = useAuth();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (role && profile?.role !== role) {
      router.replace("/");
    }
  }, [loading, profile?.role, role, router, user]);

  if (!isSupabaseConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          {supabaseSetupMessage}
        </div>
      </main>
    );
  }

  if (loading || !user || (role && profile?.role !== role)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          Checking access...
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
