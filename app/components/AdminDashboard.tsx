"use client";

import { Check, RotateCcw, X, Hand, Clock3, CheckCircle2, XCircle, Package } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { ItemCard } from "@/app/components/ItemCard";
import { supabase, supabaseSetupMessage } from "@/app/lib/supabase";
import type { Item, ItemStatus, ClaimStatus } from "@/app/lib/database.types";

type QueueFilter = Extract<ItemStatus, "pending" | "approved" | "returned" | "rejected">;
type AdminTab = "items" | "claims";
type ClaimFilter = "pending" | "resolved" | "rejected";

const itemFilters: QueueFilter[] = ["pending", "approved", "returned", "rejected"];

const itemFilterMeta: Record<QueueFilter, { emoji: string; activeColor: string; activeBg: string; activeBorder: string }> = {
  pending:  { emoji: "⏳", activeColor: "#92400e", activeBg: "#fffbeb", activeBorder: "#fcd34d" },
  approved: { emoji: "✅", activeColor: "#166534", activeBg: "#f0fdf4", activeBorder: "#86efac" },
  returned: { emoji: "↩️", activeColor: "#1e40af", activeBg: "#eff6ff", activeBorder: "#93c5fd" },
  rejected: { emoji: "❌", activeColor: "#9f1239", activeBg: "#fff1f2", activeBorder: "#fca5a5" },
};

const claimFilterMeta: Record<ClaimFilter, { emoji: string; activeColor: string; activeBg: string; activeBorder: string }> = {
  pending:  { emoji: "⏳", activeColor: "#92400e", activeBg: "#fffbeb", activeBorder: "#fcd34d" },
  resolved: { emoji: "✅", activeColor: "#166534", activeBg: "#f0fdf4", activeBorder: "#86efac" },
  rejected: { emoji: "❌", activeColor: "#9f1239", activeBg: "#fff1f2", activeBorder: "#fca5a5" },
};

type ClaimWithDetails = {
  id: string;
  created_at: string;
  message: string;
  status: ClaimStatus;
  item_id: string;
  student_id: string;
  items: { description: string; category: string; image_url: string | null; status: string } | null;
  profiles: { email: string } | null;
};

const claimDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});

export function AdminDashboard() {
  // Tab state
  const [activeTab, setActiveTab] = useState<AdminTab>("items");

  // Items state
  const [items, setItems] = useState<Item[]>([]);
  const [itemFilter, setItemFilter] = useState<QueueFilter>("pending");
  const [loadingItems, setLoadingItems] = useState(true);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  // Claims state
  const [claims, setClaims] = useState<ClaimWithDetails[]>([]);
  const [claimFilter, setClaimFilter] = useState<ClaimFilter>("pending");
  const [loadingClaims, setLoadingClaims] = useState(true);
  const [busyClaimId, setBusyClaimId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const highlightRef = useRef<HTMLDivElement | null>(null);

  // Switch to items tab and correct filter when navigating from notification
  useEffect(() => {
    if (!highlightId || items.length === 0) return;
    const target = items.find((i) => i.id === highlightId);
    if (target) {
      setActiveTab("items");
      setItemFilter(target.status as QueueFilter);
    }
  }, [highlightId, items]);

  useEffect(() => {
    if (!highlightRef.current) return;
    const timer = setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    return () => clearTimeout(timer);
  }, [itemFilter, highlightId]);

  // ── Load items ──────────────────────────────────────────────────────────────
  const loadItems = useCallback(async () => {
    if (!supabase) { setLoadingItems(false); setError(supabaseSetupMessage); return; }
    setError(null);
    const { data, error: loadError } = await supabase
      .from("items").select("*").in("status", itemFilters).order("created_at", { ascending: false });
    if (loadError) { setError(loadError.message); setItems([]); }
    else setItems(data ?? []);
    setLoadingItems(false);
  }, []);

  useEffect(() => {
    if (!supabase) { setLoadingItems(false); setError(supabaseSetupMessage); return; }
    const client = supabase;
    loadItems();
    const channel = client
      .channel("admin-items")
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, loadItems)
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [loadItems]);

  // ── Load claims ──────────────────────────────────────────────────────────────
  const loadClaims = useCallback(async () => {
    if (!supabase) { setLoadingClaims(false); return; }
    const { data, error: loadError } = await supabase
      .from("claims")
      .select("id, created_at, message, status, item_id, student_id, items(description, category, image_url, status), profiles(email)")
      .order("created_at", { ascending: false });
    if (!loadError) setClaims((data as ClaimWithDetails[]) ?? []);
    setLoadingClaims(false);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    loadClaims();
    const channel = client
      .channel("admin-claims")
      .on("postgres_changes", { event: "*", schema: "public", table: "claims" }, loadClaims)
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [loadClaims]);

  // ── Item actions ─────────────────────────────────────────────────────────────
  async function updateItemStatus(itemId: string, status: ItemStatus) {
    if (!supabase) return;
    setBusyItemId(itemId);
    const { data: item } = await supabase
      .from("items").select("user_id, description").eq("id", itemId).single();
    const { error: updateError } = await supabase
      .from("items").update({ status }).eq("id", itemId);
    if (!updateError && item) {
      await supabase.from("notifications").insert({
        user_id: item.user_id,
        item_id: itemId,
        type: status === "approved" ? "item_approved" : status === "returned" ? "item_returned" : "item_rejected",
        message: `Your item "${item.description.substring(0, 15)}…" was ${status}.`,
        is_read: false,
      });
    }
    setBusyItemId(null);
  }

  // ── Claim actions ────────────────────────────────────────────────────────────
  async function updateClaimStatus(claimId: string, status: ClaimStatus) {
    if (!supabase) return;
    setBusyClaimId(claimId);

    const claim = claims.find((c) => c.id === claimId);

    const { error: updateError } = await supabase
      .from("claims").update({ status }).eq("id", claimId);

    if (!updateError && claim) {
      // Notify the student
      await supabase.from("notifications").insert({
        user_id: claim.student_id,
        item_id: claim.item_id,
        type: status === "resolved" ? "claim_approved" : "claim_rejected",
        message: status === "resolved"
          ? `Your claim on "${claim.items?.description?.substring(0, 20) ?? "an item"}…" was approved. Collect your item!`
          : `Your claim on "${claim.items?.description?.substring(0, 20) ?? "an item"}…" was not approved.`,
        is_read: false,
      });

      // If approved, also mark the item as returned
      if (status === "resolved") {
        await supabase.from("items").update({ status: "returned" }).eq("id", claim.item_id);
      }
    }

    setBusyClaimId(null);
  }

  // ── Derived counts ───────────────────────────────────────────────────────────
  const itemCounts = useMemo(
    () => Object.fromEntries(itemFilters.map((f) => [f, items.filter((i) => i.status === f).length])),
    [items]
  );

  const claimCounts = useMemo(
    () => ({
      pending:  claims.filter((c) => c.status === "pending").length,
      resolved: claims.filter((c) => c.status === "resolved").length,
      rejected: claims.filter((c) => c.status === "rejected").length,
    }),
    [claims]
  );

  const visibleItems = useMemo(
    () => items.filter((item) => item.status === itemFilter),
    [itemFilter, items]
  );

  const visibleClaims = useMemo(
    () => claims.filter((c) => c.status === claimFilter),
    [claimFilter, claims]
  );

  const totalPendingClaims = claimCounts.pending;

  return (
    <main className="min-h-screen" style={{ background: "var(--cream)" }}>
      <AppHeader sectionTitle="Admin Dashboard" sectionSubtitle="Moderation queue" tone="admin" />

      {/* Hero strip */}
      <div className="border-b"
        style={{ background: "linear-gradient(135deg, #f8f7f4 0%, #f2ede6 100%)", borderColor: "var(--sand)" }}>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--ink-muted)" }}>
            Admin Panel
          </p>
          <h2 className="text-2xl font-semibold" style={{ fontFamily: "Lora, serif", color: "var(--ink)" }}>
            Moderation Queue
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--ink-muted)" }}>
            Review items and manage student claims.
          </p>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Main tabs: Items / Claims */}
        <div className="mb-6 flex gap-2 border-b" style={{ borderColor: "var(--sand)" }}>
          {([
            { key: "items",  label: "Items",  emoji: "📦", badge: itemCounts["pending"] },
            { key: "claims", label: "Claims", emoji: "✋", badge: totalPendingClaims },
          ] as { key: AdminTab; label: string; emoji: string; badge: number }[]).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className="relative inline-flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all"
              style={{
                color: activeTab === tab.key ? "var(--terracotta)" : "var(--ink-muted)",
                borderBottom: activeTab === tab.key ? "2.5px solid var(--terracotta)" : "2.5px solid transparent",
                marginBottom: -1,
                background: "transparent",
              }}
            >
              <span>{tab.emoji}</span>
              {tab.label}
              {tab.badge > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-black text-white"
                  style={{ background: "var(--terracotta)" }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}

          {error && (
            <p className="ml-auto self-center rounded-full px-4 py-1.5 text-xs font-semibold"
              style={{ background: "var(--rose-pale)", color: "var(--rose-warm)" }}>
              {error}
            </p>
          )}
        </div>

        {/* ── ITEMS TAB ────────────────────────────────────────────────────────── */}
        {activeTab === "items" && (
          <>
            {/* Item filter chips */}
            <div className="mb-6 flex flex-wrap gap-2">
              {itemFilters.map((f) => {
                const isActive = itemFilter === f;
                const meta = itemFilterMeta[f];
                return (
                  <button key={f} type="button" onClick={() => setItemFilter(f)}
                    className="inline-flex items-center gap-2 h-10 rounded-full px-4 text-sm font-bold capitalize transition-all"
                    style={{
                      background: isActive ? meta.activeBg : "#fff",
                      color: isActive ? meta.activeColor : "var(--ink-soft)",
                      border: `1.5px solid ${isActive ? meta.activeBorder : "var(--sand)"}`,
                      boxShadow: isActive ? `0 2px 8px ${meta.activeBorder}80` : "none",
                    }}>
                    <span>{meta.emoji}</span>
                    {f}
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-black"
                      style={{
                        background: isActive ? meta.activeBorder : "var(--cream-dark)",
                        color: isActive ? meta.activeColor : "var(--ink-muted)",
                      }}>
                      {itemCounts[f]}
                    </span>
                  </button>
                );
              })}
            </div>

            {loadingItems ? (
              <div className="rounded-2xl p-12 text-center text-sm"
                style={{ background: "#fff", color: "var(--ink-muted)", boxShadow: "var(--shadow-card)" }}>
                <span className="block text-3xl mb-3 animate-pulse">📋</span>
                Loading queue…
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="rounded-2xl p-12 text-center text-sm"
                style={{ background: "#fff", color: "var(--ink-muted)", boxShadow: "var(--shadow-card)" }}>
                <span className="block text-3xl mb-3">🎉</span>
                No <span className="font-bold capitalize">{itemFilter}</span> items — all clear!
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {visibleItems.map((item) => {
                  const isHighlighted = item.id === highlightId;
                  return (
                    <div key={item.id}
                      ref={isHighlighted ? highlightRef : null}
                      className="space-y-3 transition-all duration-500"
                      style={isHighlighted ? {
                        outline: "2.5px solid var(--terracotta)",
                        borderRadius: 20,
                        boxShadow: "0 0 0 6px var(--terra-pale)",
                      } : undefined}>
                      <ItemCard item={item} showStatus />
                     <div className="grid grid-cols-2 gap-2 rounded-2xl p-3"
  style={{ background: "#fff", boxShadow: "var(--shadow-card)" }}>
  <button type="button" onClick={() => updateItemStatus(item.id, "approved")}
    disabled={busyItemId === item.id}
    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
    style={{ background: "linear-gradient(135deg, var(--moss), #6aaa7a)" }}>
    <Check className="h-3.5 w-3.5" /> Approve
  </button>
  <button type="button" onClick={() => updateItemStatus(item.id, "rejected")}
    disabled={busyItemId === item.id}
    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
    style={{ background: "linear-gradient(135deg, var(--rose-warm), #e05a62)" }}>
    <X className="h-3.5 w-3.5" /> Reject
  </button>
</div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── CLAIMS TAB ───────────────────────────────────────────────────────── */}
        {activeTab === "claims" && (
          <>
            {/* Claim filter chips */}
            <div className="mb-6 flex flex-wrap gap-2">
              {(["pending", "resolved", "rejected"] as ClaimFilter[]).map((f) => {
                const isActive = claimFilter === f;
                const meta = claimFilterMeta[f];
                return (
                  <button key={f} type="button" onClick={() => setClaimFilter(f)}
                    className="inline-flex items-center gap-2 h-10 rounded-full px-4 text-sm font-bold capitalize transition-all"
                    style={{
                      background: isActive ? meta.activeBg : "#fff",
                      color: isActive ? meta.activeColor : "var(--ink-soft)",
                      border: `1.5px solid ${isActive ? meta.activeBorder : "var(--sand)"}`,
                      boxShadow: isActive ? `0 2px 8px ${meta.activeBorder}80` : "none",
                    }}>
                    <span>{meta.emoji}</span>
                    {f}
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-black"
                      style={{
                        background: isActive ? meta.activeBorder : "var(--cream-dark)",
                        color: isActive ? meta.activeColor : "var(--ink-muted)",
                      }}>
                      {claimCounts[f]}
                    </span>
                  </button>
                );
              })}
            </div>

            {loadingClaims ? (
              <div className="rounded-2xl p-12 text-center text-sm"
                style={{ background: "#fff", color: "var(--ink-muted)", boxShadow: "var(--shadow-card)" }}>
                <span className="block text-3xl mb-3 animate-pulse">✋</span>
                Loading claims…
              </div>
            ) : visibleClaims.length === 0 ? (
              <div className="rounded-2xl p-12 text-center text-sm"
                style={{ background: "#fff", color: "var(--ink-muted)", boxShadow: "var(--shadow-card)" }}>
                <span className="block text-3xl mb-3">🎉</span>
                No <span className="font-bold capitalize">{claimFilter}</span> claims — all clear!
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleClaims.map((claim) => {
                  const isBusy = busyClaimId === claim.id;
                  const isPending = claim.status === "pending";
                  return (
                    <div key={claim.id} className="rounded-2xl border overflow-hidden"
                      style={{ background: "#fff", borderColor: "var(--sand)", boxShadow: "var(--shadow-card)" }}>

                      {/* Item info header */}
                      <div className="px-4 py-3 border-b flex items-center gap-3"
                        style={{ borderColor: "var(--sand)", background: "#fdfaf7" }}>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: "var(--terra-pale)" }}>
                          <Package className="h-4 w-4" style={{ color: "var(--terracotta)" }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wide mb-0.5"
                            style={{ color: "var(--ink-muted)" }}>
                            Claimed item
                          </p>
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
                            {claim.items?.description
                              ? `"${claim.items.description.substring(0, 35)}${claim.items.description.length > 35 ? "…" : ""}"`
                              : "Item not found"}
                          </p>
                        </div>
                      </div>

                      {/* Claim body */}
                      <div className="p-4 space-y-3">
                        {/* Student */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-1"
                            style={{ color: "var(--ink-muted)" }}>
                            Student
                          </p>
                          <p className="text-sm font-medium" style={{ color: "var(--ink-soft)" }}>
                            {claim.profiles?.email ?? "Unknown"}
                          </p>
                        </div>

                        {/* Claim message */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-1"
                            style={{ color: "var(--ink-muted)" }}>
                            Their message
                          </p>
                          <p className="text-sm leading-relaxed rounded-xl p-3"
                            style={{ background: "var(--cream)", color: "var(--ink-soft)" }}>
                            {claim.message}
                          </p>
                        </div>

                        {/* Date */}
                        <p className="text-[10px]" style={{ color: "var(--ink-muted)" }}>
                          Submitted {claimDateFormatter.format(new Date(claim.created_at))}
                        </p>

                        {/* Actions — only shown for pending claims */}
                        {isPending ? (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button type="button"
                              onClick={() => updateClaimStatus(claim.id, "resolved")}
                              disabled={isBusy}
                              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                              style={{ background: "linear-gradient(135deg, var(--moss), #6aaa7a)" }}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approve & Return
                            </button>
                            <button type="button"
                              onClick={() => updateClaimStatus(claim.id, "rejected")}
                              disabled={isBusy}
                              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                              style={{ background: "linear-gradient(135deg, var(--rose-warm), #e05a62)" }}>
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="pt-1">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold`}
                              style={{
                                background: claim.status === "resolved" ? "#f0fdf4" : "#fff1f2",
                                color: claim.status === "resolved" ? "#166534" : "#9f1239",
                              }}>
                              {claim.status === "resolved"
                                ? <><CheckCircle2 className="h-3.5 w-3.5" /> Approved & returned</>
                                : <><XCircle className="h-3.5 w-3.5" /> Rejected</>
                              }
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
