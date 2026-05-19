"use client";

import Link from "next/link";
import { ImagePlus, Search, X, Hand, Clock3, CheckCircle2, XCircle, MapPin } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/app/components/AppHeader";
import { ItemCard } from "@/app/components/ItemCard";
import { useAuth } from "@/app/hooks/useAuth";
import type { Item, ItemCategory, ClaimStatus } from "@/app/lib/database.types";
import { supabase, supabaseSetupMessage } from "@/app/lib/supabase";

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: { value: ItemCategory; label: string; emoji: string }[] = [
  { value: "electronics", label: "Electronics", emoji: "💻" },
  { value: "clothes",     label: "Clothes",     emoji: "👕" },
  { value: "books",       label: "Books",       emoji: "📚" },
  { value: "accessories", label: "Accessories", emoji: "👓" },
  { value: "bags",        label: "Bags",        emoji: "🎒" },
  { value: "keys",        label: "Keys",        emoji: "🔑" },
  { value: "stationery",  label: "Stationery",  emoji: "✏️" },
  { value: "other",       label: "Other",       emoji: "📦" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type ClaimWithItem = {
  id: string;
  created_at: string;
  message: string;
  status: ClaimStatus;
  item_id: string;
  items: { description: string; category: string } | null;
};

type LostItem = {
  id: string;
  user_id: string;
  description: string;
  category: ItemCategory;
  image_url: string | null;
  contact_info: string | null;
  created_at: string;
  profiles?: { email: string; matric_number: string | null } | null;
};

// "Found Items" vs "Lost Items" — the main feed toggle
type FeedTab = "found" | "lost";

// "Found an item" vs "I lost something" — the sidebar submit toggle
type SubmitTab = "found" | "lost";

// ── Claim status display ──────────────────────────────────────────────────────

const claimStatusMeta: Record<ClaimStatus, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  pending:  { label: "Pending",  icon: <Clock3      className="h-3 w-3" />, color: "#92400e", bg: "#fffbeb" },
  resolved: { label: "Resolved", icon: <CheckCircle2 className="h-3 w-3" />, color: "#166534", bg: "#f0fdf4" },
  rejected: { label: "Rejected", icon: <XCircle      className="h-3 w-3" />, color: "#9f1239", bg: "#fff1f2" },
};

const claimDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudentPortalPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const searchParams = useSearchParams();
  const highlightId  = searchParams.get("highlight");

  // ── Found-items feed ──────────────────────────────────────────────────────
  const [items, setItems]                   = useState<Item[]>([]);
  const [loadingFeed, setLoadingFeed]       = useState(true);

  // ── Lost-items feed ───────────────────────────────────────────────────────
  const [lostItems, setLostItems]           = useState<LostItem[]>([]);
  const [loadingLost, setLoadingLost]       = useState(true);

  // ── Submit: Found form ────────────────────────────────────────────────────
  const [foundDesc, setFoundDesc]           = useState("");
  const [foundCategory, setFoundCategory]   = useState<ItemCategory>("other");
  const [foundPhoto, setFoundPhoto]         = useState<File | null>(null);
  const [submittingFound, setSubmittingFound] = useState(false);

  // ── Submit: Lost form ─────────────────────────────────────────────────────
  const [lostDesc, setLostDesc]             = useState("");
  const [lostCategory, setLostCategory]     = useState<ItemCategory>("other");
  const [lostPhoto, setLostPhoto]           = useState<File | null>(null);
  const [lostContact, setLostContact]       = useState("");
  const [submittingLost, setSubmittingLost] = useState(false);

  // ── Shared UI state ───────────────────────────────────────────────────────
  const [notice, setNotice]                 = useState<string | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [searchQuery, setSearchQuery]       = useState("");
  const [activeCategory, setActiveCategory] = useState<ItemCategory | null>(null);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [feedTab, setFeedTab]               = useState<FeedTab>("found");
  const [submitTab, setSubmitTab]           = useState<SubmitTab>("found");

  // ── My Claims ─────────────────────────────────────────────────────────────
  const [myClaims, setMyClaims]             = useState<ClaimWithItem[]>([]);
  const [loadingClaims, setLoadingClaims]   = useState(false);
  const claimsChannelRef                    = useRef<any>(null);

  // ── Highlight scroll ──────────────────────────────────────────────────────
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!highlightId || loadingFeed) return;
    const timer = setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    return () => clearTimeout(timer);
  }, [highlightId, loadingFeed]);

  // ── Load found-items feed ─────────────────────────────────────────────────
  const PAGE_SIZE = 12;
  const [foundPage, setFoundPage]       = useState(0);
  const [foundHasMore, setFoundHasMore] = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);

  const loadFeed = useCallback(async (page = 0) => {
    if (!supabase) { setLoadingFeed(false); setError(supabaseSetupMessage); return; }
    if (page === 0) setLoadingFeed(true); else setLoadingMore(true);
    setError(null);
    const from = page * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;
    const { data, error: e } = await supabase
      .from("items")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (e) { setError(e.message); }
    else {
      setItems((prev) => page === 0 ? (data ?? []) : [...prev, ...(data ?? [])]);
      setFoundHasMore((data ?? []).length === PAGE_SIZE);
      setFoundPage(page);
    }
    if (page === 0) setLoadingFeed(false); else setLoadingMore(false);
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    loadFeed(0);
    const ch = client.channel("student-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "items", filter: "status=eq.approved" }, () => loadFeed(0))
      .subscribe();
    return () => { client.removeChannel(ch); };
  }, [loadFeed]);

  // ── Load lost-items feed ──────────────────────────────────────────────────
  const [lostPage, setLostPage]         = useState(0);
  const [lostHasMore, setLostHasMore]   = useState(true);
  const [loadingMoreLost, setLoadingMoreLost] = useState(false);

  const loadLostFeed = useCallback(async (page = 0) => {
    if (!supabase) { setLoadingLost(false); return; }
    if (page === 0) setLoadingLost(true); else setLoadingMoreLost(true);
    const from = page * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;
    const { data, error: e } = await supabase
      .from("lost_items")
      .select("*, profiles(email, matric_number)")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (!e) {
      setLostItems((prev) => page === 0 ? (data ?? []) as LostItem[] : [...prev, ...(data ?? []) as LostItem[]]);
      setLostHasMore((data ?? []).length === PAGE_SIZE);
      setLostPage(page);
    }
    if (page === 0) setLoadingLost(false); else setLoadingMoreLost(false);
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    loadLostFeed(0);
    const ch = client.channel("lost-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "lost_items" }, () => loadLostFeed(0))
      .subscribe();
    return () => { client.removeChannel(ch); };
  }, [loadLostFeed]);

  // ── Load my claims ────────────────────────────────────────────────────────
  const loadMyClaims = useCallback(async () => {
    if (!supabase || !user) return;
    setLoadingClaims(true);
    const { data } = await supabase
      .from("claims")
      .select("id, created_at, message, status, item_id, items(description, category)")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false });
    setMyClaims((data as ClaimWithItem[]) ?? []);
    setLoadingClaims(false);
  }, [user?.id]);

  useEffect(() => {
    const client = supabase;
    if (!client || !user?.id) return;
    loadMyClaims();
    const ch = client.channel(`my-claims-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "claims", filter: `student_id=eq.${user.id}` }, loadMyClaims)
      .subscribe();
    claimsChannelRef.current = ch;
    return () => { if (claimsChannelRef.current) client.removeChannel(claimsChannelRef.current); };
  }, [user?.id, loadMyClaims]);

  // ── Filtered feed (applies to whichever tab is active) ───────────────────
  const filteredFoundItems = useMemo(() => {
    let result = items;
    if (activeCategory) result = result.filter((i) => i.category === activeCategory);
    const q = searchQuery.trim().toLowerCase();
    if (q) result = result.filter((i) => i.description.toLowerCase().includes(q));
    return result;
  }, [items, searchQuery, activeCategory]);

  const filteredLostItems = useMemo(() => {
    let result = lostItems;
    if (activeCategory) result = result.filter((i) => i.category === activeCategory);
    const q = searchQuery.trim().toLowerCase();
    if (q) result = result.filter((i) => i.description.toLowerCase().includes(q));
    return result;
  }, [lostItems, searchQuery, activeCategory]);

  const isFiltered = activeCategory !== null || searchQuery.trim() !== "";
  const activeItems   = feedTab === "found" ? filteredFoundItems : filteredLostItems;
  const activeLoading = feedTab === "found" ? loadingFeed : loadingLost;

  // ── Upload helper ─────────────────────────────────────────────────────────
  async function uploadPhoto(file: File, userId: string): Promise<string> {
    const ext  = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase!.storage.from("item-photos").upload(path, file);
    if (uploadError) throw uploadError;
    return supabase!.storage.from("item-photos").getPublicUrl(path).data.publicUrl;
  }

  // ── Submit found item ─────────────────────────────────────────────────────
  async function submitFoundItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!supabase || !user) { setError(!user ? "Sign in before submitting." : supabaseSetupMessage); return; }
    setSubmittingFound(true); setError(null); setNotice(null);
    try {
      let imageUrl: string | null = null;
      if (foundPhoto) imageUrl = await uploadPhoto(foundPhoto, user.id);

      const { error: insertError } = await supabase.from("items").insert({
        description: foundDesc.trim(), image_url: imageUrl, category: foundCategory, user_id: user.id,
      });
      if (insertError) throw insertError;

      const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin");
      if (admins?.length) {
        await supabase.from("notifications").insert(
          admins.map((a) => ({
            user_id: a.id,
            type: "item_created",
            message: `${user.email} uploaded a new item: ${foundDesc.substring(0, 20)}...`,
            is_read: false,
          }))
        );
      }
      setFoundDesc(""); setFoundCategory("other"); setFoundPhoto(null);
      setNotice("✅ Submitted for admin approval.");
      form.reset();
    } catch (e: any) {
      setError(e.message || "Could not submit item.");
    } finally {
      setSubmittingFound(false);
    }
  }

  // ── Submit lost item ──────────────────────────────────────────────────────
  async function submitLostItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!supabase || !user) { setError(!user ? "Sign in before posting." : supabaseSetupMessage); return; }
    setSubmittingLost(true); setError(null); setNotice(null);
    try {
      let imageUrl: string | null = null;
      if (lostPhoto) imageUrl = await uploadPhoto(lostPhoto, user.id);

      const { error: insertError } = await supabase.from("lost_items").insert({
        description: lostDesc.trim(),
        image_url: imageUrl,
        category: lostCategory,
        user_id: user.id,
        contact_info: lostContact.trim() || null,
      });
      if (insertError) throw insertError;

      setLostDesc(""); setLostCategory("other"); setLostPhoto(null); setLostContact("");
      setNotice("📢 Posted to Lost Items — other students can now see it!");
      // Auto-switch feed to lost tab so they see their post immediately
      setFeedTab("lost");
      form.reset();
    } catch (e: any) {
      setError(e.message || "Could not post lost item.");
    } finally {
      setSubmittingLost(false);
    }
  }

  // ── Submit claim ──────────────────────────────────────────────────────────
  async function submitClaim(itemId: string, message: string) {
    if (!supabase || !user) throw new Error(!user ? "Sign in before claiming." : supabaseSetupMessage);

    // Duplicate check — has this student already claimed this item?
    const { data: existing } = await supabase
      .from("claims")
      .select("id, status")
      .eq("item_id", itemId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (existing) {
      const msg =
        existing.status === "pending"  ? "You already have a pending claim on this item." :
        existing.status === "resolved" ? "Your claim for this item was already approved!" :
                                         "You already claimed this item (it was not approved). You can't claim it again.";
      throw new Error(msg);
    }

    const { error: claimError } = await supabase.from("claims").insert({
      item_id: itemId, student_id: user.id, message: message.trim(), status: "pending",
    });
    if (claimError) throw claimError;
    const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin");
    if (admins?.length) {
      await supabase.from("notifications").insert(
        admins.map((a) => ({
          user_id: a.id,
          item_id: itemId,
          type: "claim_created",
          message: `${user.email} has claimed an item.`,
          is_read: false,
        }))
      );
    }
    setNotice("Claim sent to the admin team.");
  }

  // ── Shared category picker ────────────────────────────────────────────────
  function CategoryPicker({
    value, onChange,
  }: { value: ItemCategory; onChange: (v: ItemCategory) => void }) {
    return (
      <div className="grid grid-cols-2 gap-1.5">
        {CATEGORIES.map((cat) => (
          <button key={cat.value} type="button" onClick={() => onChange(cat.value)}
            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition"
            style={{
              borderColor: value === cat.value ? "var(--terracotta)" : "var(--sand)",
              background:  value === cat.value ? "var(--terra-pale)" : "#fff",
              color:       value === cat.value ? "var(--terracotta)" : "var(--ink-soft)",
            }}>
            <span>{cat.emoji}</span><span>{cat.label}</span>
          </button>
        ))}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen" style={{ background: "var(--cream)" }}>
      <AppHeader />

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[360px_1fr] lg:px-8">

        {/* ════════════════════ SIDEBAR ════════════════════ */}
        <div className="flex flex-col gap-4">

          {/* Submit panel */}
          <aside className="rounded-2xl border p-5 shadow-sm"
            style={{ background: "#fff", borderColor: "var(--sand)", boxShadow: "var(--shadow-card)" }}>

            {/* Submit tab toggle */}
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl p-1" style={{ background: "var(--cream-dark)" }}>
              <button type="button" onClick={() => { setSubmitTab("found"); setNotice(null); setError(null); }}
                className="flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: submitTab === "found" ? "#fff" : "transparent",
                  color:      submitTab === "found" ? "var(--moss)" : "var(--ink-muted)",
                  boxShadow:  submitTab === "found" ? "var(--shadow-card)" : "none",
                }}>
                <ImagePlus className="h-3.5 w-3.5" />
                Found an item
              </button>
              <button type="button" onClick={() => { setSubmitTab("lost"); setNotice(null); setError(null); }}
                className="flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: submitTab === "lost" ? "#fff" : "transparent",
                  color:      submitTab === "lost" ? "var(--amber)" : "var(--ink-muted)",
                  boxShadow:  submitTab === "lost" ? "var(--shadow-card)" : "none",
                }}>
                <MapPin className="h-3.5 w-3.5" />
                I lost something
              </button>
            </div>

            {/* ── Found item form ── */}
            {submitTab === "found" && (
              <>
                <div className="mb-4 flex items-center gap-2">
                  <ImagePlus className="h-5 w-5" style={{ color: "var(--moss)" }} />
                  <div>
                    <h2 className="text-sm font-bold" style={{ fontFamily: "Lora, serif", color: "var(--ink)" }}>
                      Submit a found item
                    </h2>
                    <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                      Goes to admin for approval before appearing in the feed.
                    </p>
                  </div>
                </div>

                {authLoading ? (
                  <p className="text-sm" style={{ color: "var(--ink-muted)" }}>Checking session...</p>
                ) : !user ? (
                  <NotLoggedIn />
                ) : (
                  <form onSubmit={submitFoundItem} className="space-y-4">
                    <textarea value={foundDesc} onChange={(e) => setFoundDesc(e.target.value)}
                      rows={4} required placeholder="Describe the item you found..."
                      className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none transition"
                      style={{ borderColor: "var(--sand)", color: "var(--ink-soft)" }}
                    />
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-widest" style={{ color: "var(--ink-muted)" }}>
                        Category
                      </label>
                      <CategoryPicker value={foundCategory} onChange={setFoundCategory} />
                    </div>
                    <input type="file" accept="image/*" onChange={(e) => setFoundPhoto(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm file:mr-3 file:h-9 file:rounded-lg file:border-0 file:px-3 file:text-xs file:font-bold file:text-white cursor-pointer"
                      style={{ color: "var(--ink-muted)" }}
                    />
                    <button type="submit" disabled={submittingFound || !foundDesc.trim()}
                      className="h-10 w-full rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg, var(--moss), #6aaa7a)" }}>
                      {submittingFound ? "Submitting..." : "Submit for approval"}
                    </button>
                  </form>
                )}
              </>
            )}

            {/* ── Lost item form ── */}
            {submitTab === "lost" && (
              <>
                <div className="mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5" style={{ color: "var(--amber)" }} />
                  <div>
                    <h2 className="text-sm font-bold" style={{ fontFamily: "Lora, serif", color: "var(--ink)" }}>
                      Post a lost item
                    </h2>
                    <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                      Goes live instantly — no admin approval needed.
                    </p>
                  </div>
                </div>

                {authLoading ? (
                  <p className="text-sm" style={{ color: "var(--ink-muted)" }}>Checking session...</p>
                ) : !user ? (
                  <NotLoggedIn />
                ) : (
                  <form onSubmit={submitLostItem} className="space-y-4">
                    <textarea value={lostDesc} onChange={(e) => setLostDesc(e.target.value)}
                      rows={4} required placeholder="Describe what you lost and where you last saw it..."
                      className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none transition"
                      style={{ borderColor: "var(--sand)", color: "var(--ink-soft)" }}
                    />
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-widest" style={{ color: "var(--ink-muted)" }}>
                        Category
                      </label>
                      <CategoryPicker value={lostCategory} onChange={setLostCategory} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest" style={{ color: "var(--ink-muted)" }}>
                        Contact info <span className="normal-case font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={lostContact}
                        onChange={(e) => setLostContact(e.target.value)}
                        maxLength={120}
                        placeholder="e.g. call/text 08012345678 or @yourhandle"
                        className="h-10 w-full rounded-xl border px-3 text-sm outline-none transition"
                        style={{ borderColor: "var(--sand)", color: "var(--ink-soft)", background: "#fff" }}
                      />
                      <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                        Shown publicly on your post so people can reach you.
                      </p>
                    </div>
                    <input type="file" accept="image/*" onChange={(e) => setLostPhoto(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm file:mr-3 file:h-9 file:rounded-lg file:border-0 file:px-3 file:text-xs file:font-bold file:text-white cursor-pointer"
                      style={{ color: "var(--ink-muted)" }}
                    />
                    <button type="submit" disabled={submittingLost || !lostDesc.trim()}
                      className="h-10 w-full rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg, var(--amber), #f59e0b)" }}>
                      {submittingLost ? "Posting..." : "Post to Lost Items"}
                    </button>
                  </form>
                )}
              </>
            )}

            {isAdmin && (
              <Link href="/admin"
                className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl border text-sm font-semibold transition hover:opacity-80"
                style={{ borderColor: "var(--sand)", color: "var(--ink-soft)" }}>
                Open admin dashboard
              </Link>
            )}

            {notice && <p className="mt-4 text-sm font-semibold" style={{ color: "var(--moss)" }}>{notice}</p>}
            {error  && <p className="mt-4 text-sm font-semibold" style={{ color: "var(--rose-warm)" }}>{error}</p>}
          </aside>

          {/* My Claims panel — only when logged in */}
          {user && (
            <aside className="rounded-2xl border p-5"
              style={{ background: "#fff", borderColor: "var(--sand)", boxShadow: "var(--shadow-card)" }}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hand className="h-[18px] w-[18px]" style={{ color: "var(--terracotta)" }} />
                  <h2 className="text-base font-bold" style={{ fontFamily: "Lora, serif", color: "var(--ink)" }}>
                    My Claims
                  </h2>
                </div>
                {myClaims.length > 0 && (
                  <span className="rounded-full px-2 py-0.5 text-xs font-black"
                    style={{ background: "var(--terra-pale)", color: "var(--terracotta)" }}>
                    {myClaims.length}
                  </span>
                )}
              </div>

              {loadingClaims ? (
                <div className="py-6 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
                  <span className="block text-2xl mb-2 animate-pulse">✋</span>
                  Loading claims...
                </div>
              ) : myClaims.length === 0 ? (
                <div className="py-6 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
                  <span className="block text-2xl mb-2">📭</span>
                  No claims submitted yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {myClaims.map((claim) => {
                    const meta = claimStatusMeta[claim.status];
                    return (
                      <div key={claim.id} className="rounded-xl border p-3"
                        style={{ borderColor: "var(--sand)", background: "#fdfaf7" }}>
                        <p className="text-sm font-medium leading-snug mb-2" style={{ color: "var(--ink)" }}>
                          {claim.items?.description
                            ? `"${claim.items.description.substring(0, 40)}${claim.items.description.length > 40 ? "…" : ""}"`
                            : "Item not found"}
                        </p>
                        <p className="text-xs leading-relaxed mb-2 line-clamp-2" style={{ color: "var(--ink-soft)" }}>
                          Your message: {claim.message}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                            style={{ background: meta.bg, color: meta.color }}>
                            {meta.icon}{meta.label}
                          </span>
                          <time className="text-[10px]" style={{ color: "var(--ink-muted)" }}>
                            {claimDateFormatter.format(new Date(claim.created_at))}
                          </time>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </aside>
          )}
        </div>

        {/* ════════════════════ MAIN FEED ════════════════════ */}
        <section>

          {/* Feed tab switcher */}
          <div className="mb-4 flex gap-2">
            <button type="button" onClick={() => { setFeedTab("found"); setSearchQuery(""); setActiveCategory(null); }}
              className="inline-flex items-center gap-2 h-10 rounded-full px-4 text-sm font-bold transition-all"
              style={{
                background: feedTab === "found" ? "var(--moss)" : "#fff",
                color:      feedTab === "found" ? "#fff" : "var(--ink-soft)",
                border:     `1.5px solid ${feedTab === "found" ? "var(--moss)" : "var(--sand)"}`,
                boxShadow:  feedTab === "found" ? "0 2px 8px rgba(74,124,89,0.30)" : "none",
              }}>
              <ImagePlus className="h-4 w-4" />
              Found Items
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-black"
                style={{
                  background: feedTab === "found" ? "rgba(255,255,255,0.25)" : "var(--cream-dark)",
                  color:      feedTab === "found" ? "#fff" : "var(--ink-muted)",
                }}>
                {items.length}
              </span>
            </button>

            <button type="button" onClick={() => { setFeedTab("lost"); setSearchQuery(""); setActiveCategory(null); }}
              className="inline-flex items-center gap-2 h-10 rounded-full px-4 text-sm font-bold transition-all"
              style={{
                background: feedTab === "lost" ? "var(--amber)" : "#fff",
                color:      feedTab === "lost" ? "#fff" : "var(--ink-soft)",
                border:     `1.5px solid ${feedTab === "lost" ? "var(--amber)" : "var(--sand)"}`,
                boxShadow:  feedTab === "lost" ? "0 2px 8px rgba(217,119,6,0.30)" : "none",
              }}>
              <MapPin className="h-4 w-4" />
              Lost Items
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-black"
                style={{
                  background: feedTab === "lost" ? "rgba(255,255,255,0.25)" : "var(--cream-dark)",
                  color:      feedTab === "lost" ? "#fff" : "var(--ink-muted)",
                }}>
                {lostItems.length}
              </span>
            </button>
          </div>

          {/* Context blurb */}
          {feedTab === "lost" && (
            <div className="mb-4 rounded-xl px-4 py-3 text-sm"
              style={{ background: "#fffbeb", border: "1.5px solid #fcd34d", color: "#92400e" }}>
              <strong>These are items students have reported missing.</strong> If you found something matching a post, reach out via your school's usual channels.
            </div>
          )}

          {/* Search */}
          <div className="mb-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--ink-muted)" }} />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={feedTab === "found" ? "Search found items..." : "Search lost items..."}
              className="h-11 w-full rounded-xl border pl-9 pr-9 text-sm outline-none transition"
              style={{ borderColor: "var(--sand)", background: "#fff", color: "var(--ink-soft)" }}
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition hover:opacity-60"
                style={{ color: "var(--ink-muted)" }}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Category filter chips */}
          <div className="mb-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setActiveCategory(null)}
              className="h-8 rounded-full px-3 text-xs font-bold transition"
              style={{
                background: activeCategory === null ? "var(--ink)" : "#fff",
                color:      activeCategory === null ? "#fff" : "var(--ink-soft)",
                border:     `1.5px solid ${activeCategory === null ? "var(--ink)" : "var(--sand)"}`,
              }}>
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button key={cat.value} type="button"
                onClick={() => setActiveCategory(activeCategory === cat.value ? null : cat.value)}
                className="h-8 rounded-full px-3 text-xs font-bold transition"
                style={{
                  background: activeCategory === cat.value ? "var(--terra-pale)" : "#fff",
                  color:      activeCategory === cat.value ? "var(--terracotta)" : "var(--ink-soft)",
                  border:     `1.5px solid ${activeCategory === cat.value ? "var(--terracotta)" : "var(--sand)"}`,
                }}>
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>

          {/* Grid */}
          {activeLoading ? (
            <div className="p-12 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
              <span className="block text-3xl mb-3 animate-pulse">{feedTab === "found" ? "🔍" : "🗺️"}</span>
              Loading {feedTab === "found" ? "found" : "lost"} items...
            </div>
          ) : activeItems.length === 0 ? (
            <div className="p-12 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
              <span className="block text-3xl mb-3">{feedTab === "found" ? "📭" : "🗺️"}</span>
              {isFiltered
                ? "No items match your search or filter."
                : feedTab === "found"
                  ? "No approved found-items yet."
                  : "No lost items posted yet. Be the first to post one!"}
            </div>
          ) : (
            <>
              {isFiltered && (
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                    {activeItems.length} result{activeItems.length !== 1 ? "s" : ""}
                    {searchQuery && ` for "${searchQuery}"`}
                    {activeCategory && ` in ${CATEGORIES.find((c) => c.value === activeCategory)?.label}`}
                  </p>
                  <button type="button" onClick={() => { setSearchQuery(""); setActiveCategory(null); }}
                    className="text-xs font-semibold transition hover:opacity-60" style={{ color: "var(--terracotta)" }}>
                    Clear filters
                  </button>
                </div>
              )}

              {/* ── Found items grid ── */}
              {feedTab === "found" && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    {(filteredFoundItems as Item[]).map((item) => {
                      const isHighlighted = item.id === highlightId;
                      return (
                        <div key={item.id}
                          ref={isHighlighted ? highlightRef : null}
                          className="transition-all duration-500"
                          style={isHighlighted ? {
                            outline: "2.5px solid var(--terracotta)",
                            borderRadius: 20,
                            boxShadow: "0 0 0 6px var(--terra-pale)",
                          } : undefined}>
                          <ItemCard item={item} viewerId={user?.id} onClaimAction={submitClaim} />
                        </div>
                      );
                    })}
                  </div>
                  {!isFiltered && foundHasMore && (
                    <div className="mt-6 text-center">
                      <button type="button" onClick={() => loadFeed(foundPage + 1)} disabled={loadingMore}
                        className="inline-flex h-10 items-center gap-2 rounded-full px-6 text-sm font-bold transition hover:opacity-90 disabled:opacity-40"
                        style={{ background: "var(--moss)", color: "#fff", boxShadow: "0 2px 8px rgba(74,124,89,0.25)" }}>
                        {loadingMore ? "Loading…" : "Load more"}
                      </button>
                    </div>
                  )}
                  {!isFiltered && !foundHasMore && items.length > 0 && (
                    <p className="mt-6 text-center text-xs" style={{ color: "var(--ink-muted)" }}>
                      You've seen all {items.length} found items.
                    </p>
                  )}
                </>
              )}

              {/* ── Lost items grid ── */}
              {feedTab === "lost" && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    {filteredLostItems.map((lostItem) => (
                      <LostItemCard
                        key={lostItem.id}
                        item={lostItem}
                        viewerId={user?.id}
                        onDelete={async (id) => {
                          if (!supabase) return;
                          await supabase.from("lost_items").delete().eq("id", id);
                          setLostItems((prev) => prev.filter((i) => i.id !== id));
                        }}
                      />
                    ))}
                  </div>
                  {!isFiltered && lostHasMore && (
                    <div className="mt-6 text-center">
                      <button type="button" onClick={() => loadLostFeed(lostPage + 1)} disabled={loadingMoreLost}
                        className="inline-flex h-10 items-center gap-2 rounded-full px-6 text-sm font-bold transition hover:opacity-90 disabled:opacity-40"
                        style={{ background: "var(--amber)", color: "#fff", boxShadow: "0 2px 8px rgba(217,119,6,0.25)" }}>
                        {loadingMoreLost ? "Loading…" : "Load more"}
                      </button>
                    </div>
                  )}
                  {!isFiltered && !lostHasMore && lostItems.length > 0 && (
                    <p className="mt-6 text-center text-xs" style={{ color: "var(--ink-muted)" }}>
                      You've seen all {lostItems.length} lost items.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </section>
    </main>
  );
}

// ── LostItemCard ──────────────────────────────────────────────────────────────

const lostDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC",
});

function LostItemCard({
  item,
  viewerId,
  onDelete,
}: {
  item: LostItem;
  viewerId?: string;
  onDelete?: (id: string) => Promise<void>;
}) {
  const cat     = CATEGORIES_MAP[item.category as ItemCategory];
  const isOwner = viewerId === item.user_id;

  // "none" | "confirm" | "deleting"
  const [deleteState, setDeleteState] = useState<"none" | "confirm" | "deleting">("none");

  async function handleDelete() {
    if (!onDelete) return;
    setDeleteState("deleting");
    await onDelete(item.id);
    // card will unmount once parent filters it out
  }

  return (
    <article className="overflow-hidden rounded-[18px] transition-all duration-200"
      style={{
        background: "#fff",
        boxShadow: "var(--shadow-card)",
        border: "1.5px solid #fde68a",
      }}>

      {/* Amber top bar */}
      <div className="px-4 py-2 flex items-center gap-2"
        style={{ background: "linear-gradient(90deg, #fffbeb, #fef3c7)", borderBottom: "1px solid #fde68a" }}>
        <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--amber)" }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#92400e" }}>
          Lost Item
        </span>
        {cat && (
          <span className="ml-auto text-xs font-semibold" style={{ color: "#a16207" }}>
            {cat.emoji} {cat.label}
          </span>
        )}
      </div>

      {/* Optional photo */}
      {item.image_url && (
        <div className="relative aspect-[4/3]" style={{ background: "var(--cream-dark)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image_url} alt="Lost item" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="p-4 space-y-3">
        <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          {item.description}
        </p>

        {/* Contact info */}
        {item.contact_info && (
          <div className="flex items-start gap-2 rounded-xl px-3 py-2.5"
            style={{ background: "var(--amber-pale)", border: "1px solid #fde68a" }}>
            <span className="text-base leading-none mt-0.5">📞</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: "#92400e" }}>
                Contact
              </p>
              <p className="text-sm font-medium break-all" style={{ color: "#78350f" }}>
                {item.contact_info}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
              {item.profiles?.email ?? "a student"}
            </p>
            {item.profiles?.matric_number && (
              <span
                className="inline-flex items-center gap-1 text-xs font-mono font-bold"
                style={{ color: "var(--terracotta)" }}
              >
                🎓 {item.profiles.matric_number}
              </span>
            )}
          </div>
          <time className="text-xs shrink-0" style={{ color: "var(--ink-muted)" }}>
            {lostDateFormatter.format(new Date(item.created_at))}
          </time>
        </div>

        {/* Owner actions */}
        {isOwner && (
          <div className="border-t pt-3" style={{ borderColor: "var(--cream-dark)" }}>
            {deleteState === "none" && (
              <div className="flex gap-2">
                {/* Mark as found — also deletes the post */}
                <button type="button" onClick={() => setDeleteState("confirm")}
                  className="flex-1 h-9 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, var(--moss), #6aaa7a)" }}>
                  ✅ I found it!
                </button>
                <button type="button" onClick={() => setDeleteState("confirm")}
                  className="h-9 w-9 flex items-center justify-center rounded-xl border transition hover:opacity-70"
                  style={{ borderColor: "#fca5a5", color: "var(--rose-warm)", background: "var(--rose-pale)" }}
                  title="Delete post">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {deleteState === "confirm" && (
              <div className="rounded-xl p-3 space-y-2"
                style={{ background: "var(--rose-pale)", border: "1.5px solid #fca5a5" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--rose-warm)" }}>
                  Remove this post? This can't be undone.
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={handleDelete}
                    className="flex-1 h-8 rounded-lg text-xs font-bold text-white transition hover:opacity-90"
                    style={{ background: "var(--rose-warm)" }}>
                    Yes, remove it
                  </button>
                  <button type="button" onClick={() => setDeleteState("none")}
                    className="flex-1 h-8 rounded-lg border text-xs font-semibold transition hover:opacity-70"
                    style={{ borderColor: "var(--sand)", color: "var(--ink-soft)", background: "#fff" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {deleteState === "deleting" && (
              <p className="text-center text-xs font-semibold animate-pulse" style={{ color: "var(--ink-muted)" }}>
                Removing…
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORIES_MAP = Object.fromEntries(
  [
    { value: "electronics", label: "Electronics", emoji: "💻" },
    { value: "clothes",     label: "Clothes",     emoji: "👕" },
    { value: "books",       label: "Books",       emoji: "📚" },
    { value: "accessories", label: "Accessories", emoji: "👓" },
    { value: "bags",        label: "Bags",        emoji: "🎒" },
    { value: "keys",        label: "Keys",        emoji: "🔑" },
    { value: "stationery",  label: "Stationery",  emoji: "✏️" },
    { value: "other",       label: "Other",       emoji: "📦" },
  ].map((c) => [c.value, c])
) as Record<ItemCategory, { value: ItemCategory; label: string; emoji: string }>;

function NotLoggedIn() {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Log in to post or claim items.</p>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/login"
          className="inline-flex h-10 items-center justify-center rounded-xl text-sm font-bold text-white transition hover:opacity-90"
          style={{ background: "var(--ink)" }}>
          Log in
        </Link>
        <Link href="/signup"
          className="inline-flex h-10 items-center justify-center rounded-xl border text-sm font-semibold transition hover:opacity-80"
          style={{ borderColor: "var(--sand)", color: "var(--ink-soft)" }}>
          Sign up
        </Link>
      </div>
    </div>
  );
}
