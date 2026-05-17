"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/app/hooks/useAuth";
import { supabase } from "@/app/lib/supabase";

const adminNotifTypes = ["claim_created", "item_created"];
const studentNotifTypes = ["claim_approved", "item_approved", "item_rejected", "item_returned"];

function getHref(type: string, itemId: string | null, isAdmin: boolean): string | null {
  if (!itemId) return null;
  const base = adminNotifTypes.includes(type) ? "/admin" : "/";
  return `${base}?highlight=${itemId}`;
}

const typeLabel: Record<string, { emoji: string; label: string }> = {
  item_approved:  { emoji: "✅", label: "Item approved" },
  item_rejected:  { emoji: "❌", label: "Item rejected" },
  item_returned:  { emoji: "↩️", label: "Item returned" },
  item_created:   { emoji: "📦", label: "New item posted" },
  claim_created:  { emoji: "✋", label: "New claim" },
  claim_approved: { emoji: "🎉", label: "Claim approved" },
};

export function NotificationBell() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const channelRef = useRef<any>(null);
  const buttonRef  = useRef<HTMLButtonElement>(null);

  // Dropdown position: on narrow screens we use a fixed full-width sheet
  // anchored to the bottom of the bell; on wider screens a regular popover.
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const relevantTypes = isAdmin ? adminNotifTypes : studentNotifTypes;

  // ── Recalculate position whenever the dropdown opens ─────────────────────
  useEffect(() => {
    if (!showNotifications || !buttonRef.current) return;

    const rect    = buttonRef.current.getBoundingClientRect();
    const vw      = window.innerWidth;
    const PANEL_W = 320;
    const GAP     = 12; // gap below the button

    if (vw < 480) {
      // Mobile: fixed, full viewport width with horizontal padding
      setDropdownStyle({
        position: "fixed",
        top:    rect.bottom + GAP,
        left:   12,
        right:  12,
        width:  "auto",
        zIndex: 9999,
      });
    } else {
      // Desktop: align right edge of panel to right edge of button,
      // but clamp so it never goes off the left side of the screen.
      const rightEdge  = rect.right;
      const idealLeft  = rightEdge - PANEL_W;
      const clampedLeft = Math.max(12, idealLeft);
      setDropdownStyle({
        position: "fixed",
        top:   rect.bottom + GAP,
        left:  clampedLeft,
        width: PANEL_W,
        zIndex: 9999,
      });
    }
  }, [showNotifications]);

  // ── Unread count ──────────────────────────────────────────────────────────
  const loadUnreadCount = useCallback(async () => {
    if (!supabase || !user) return;
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false)
      .eq("user_id", user.id)
      .in("type", relevantTypes);
    if (!error) setUnreadCount(count ?? 0);
  }, [user?.id, isAdmin]);

  useEffect(() => {
    const client = supabase;
    if (!client || !user?.id) return;
    loadUnreadCount();
    const channel = client
      .channel(`notif-realtime-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => loadUnreadCount())
      .subscribe();
    channelRef.current = channel;
    return () => { if (channelRef.current) client.removeChannel(channelRef.current); };
  }, [user?.id, isAdmin, loadUnreadCount]);

  // ── Fetch & mark read ─────────────────────────────────────────────────────
  const fetchNotifications = async () => {
    if (!supabase || !user) return;
    setLoadingNotifications(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .in("type", relevantTypes)
      .order("created_at", { ascending: false })
      .limit(15);
    setNotifications(data ?? []);
    setLoadingNotifications(false);

    const unreadIds = (data ?? []).filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length > 0) {
      await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
      setUnreadCount(0);
    }
  };

  function handleNotificationClick(type: string, itemId: string | null) {
    setShowNotifications(false);
    const href = getHref(type, itemId, isAdmin);
    if (href) router.push(href);
  }

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setShowNotifications((prev) => {
            if (!prev) fetchNotifications();
            return !prev;
          });
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-full transition-all hover:opacity-80"
        style={{
          background: "#fff",
          border: "1.5px solid var(--sand)",
          color: "var(--ink-soft)",
          boxShadow: "var(--shadow-card)",
        }}
        aria-label="Notifications"
        aria-expanded={showNotifications}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white ring-2 ring-white"
            style={{ background: "var(--terracotta)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setShowNotifications(false)}
          />

          {/* Dropdown — position calculated above */}
          <div
            className="overflow-hidden"
            style={{
              ...dropdownStyle,
              borderRadius: 20,
              background: "#fff",
              border: "1.5px solid var(--sand)",
              boxShadow: "0 12px 40px rgba(44,26,14,0.16)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{
                borderColor: "var(--cream-dark)",
                background: "linear-gradient(135deg, #fff9f4, #fdf3ea)",
              }}
            >
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" style={{ color: "var(--terracotta)" }} />
                <span
                  className="text-sm font-bold"
                  style={{ fontFamily: "Lora, serif", color: "var(--ink)" }}
                >
                  Notifications
                </span>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-bold"
                    style={{ background: "var(--terra-pale)", color: "var(--terracotta)" }}
                  >
                    {unreadCount} new
                  </span>
                )}
                {/* Close button — especially useful on mobile */}
                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-xs transition hover:opacity-60"
                  style={{ background: "var(--cream-dark)", color: "var(--ink-muted)" }}
                  aria-label="Close notifications"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: "min(320px, 60vh)" }}>
              {loadingNotifications ? (
                <div
                  className="flex flex-col items-center justify-center gap-2 p-8 text-sm"
                  style={{ color: "var(--ink-muted)" }}
                >
                  <span className="text-2xl animate-pulse">🔔</span>
                  Loading…
                </div>
              ) : notifications.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center gap-2 p-8 text-sm"
                  style={{ color: "var(--ink-muted)" }}
                >
                  <span className="text-2xl">🌿</span>
                  Nothing here yet
                </div>
              ) : (
                notifications.map((n, i) => {
                  const meta    = typeLabel[n.type] ?? { emoji: "📬", label: n.type };
                  const isUnread = !n.is_read;
                  const href    = getHref(n.type, n.item_id, isAdmin);

                  return (
                    <button
                      key={n.id}
                      type="button"
                      disabled={!href}
                      onClick={() => handleNotificationClick(n.type, n.item_id)}
                      className="w-full text-left px-4 py-3 border-b last:border-0 transition-opacity hover:opacity-75"
                      style={{
                        borderColor: "var(--cream-dark)",
                        background: isUnread
                          ? "var(--terra-pale)"
                          : i % 2 === 0 ? "#fff" : "#fdfaf7",
                        cursor: href ? "pointer" : "default",
                      }}
                    >
                      <div className="flex gap-3">
                        <span className="text-lg leading-none mt-0.5 shrink-0">
                          {meta.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-xs font-bold uppercase tracking-wide mb-0.5"
                            style={{ color: "var(--ink-muted)" }}
                          >
                            {meta.label}
                          </p>
                          <p
                            className="text-sm leading-snug"
                            style={{ color: "var(--ink-soft)", fontFamily: "Nunito, sans-serif" }}
                          >
                            {n.message}
                          </p>
                          <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                            {new Date(n.created_at).toLocaleString(undefined, {
                              month: "short", day: "numeric",
                              hour: "numeric", minute: "2-digit",
                            })}
                          </p>
                        </div>
                        {isUnread && (
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full self-start"
                            style={{ background: "var(--terracotta)" }}
                          />
                        )}
                        {href && (
                          <span
                            className="mt-1 text-xs self-center shrink-0"
                            style={{ color: "var(--ink-muted)" }}
                          >
                            →
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div
              className="px-4 py-2.5 text-center border-t"
              style={{ borderColor: "var(--cream-dark)", background: "#fdfaf7" }}
            >
              <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                Showing last {Math.min(notifications.length, 15)} notifications
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
