"use client";

import Image from "next/image";
import { CheckCircle2, Clock3, Hand, RotateCcw, XCircle } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import type { Item, ItemStatus } from "@/app/lib/database.types";

export type ItemCardProps = {
  item: Item;
  viewerId?: string;
  showStatus?: boolean;
  onClaimAction?: (itemId: string, message: string) => Promise<void>;
};

const statusStyles: Record<ItemStatus, { bg: string; text: string; border: string }> = {
  pending:  { bg: "var(--amber-pale)",  text: "var(--amber)",       border: "#fde68a" },
  approved: { bg: "var(--moss-pale)",   text: "var(--moss)",        border: "#bbf7d0" },
  returned: { bg: "var(--sky-pale)",    text: "var(--sky)",         border: "#bae6fd" },
  rejected: { bg: "var(--rose-pale)",   text: "var(--rose-warm)",   border: "#fecaca" },
};

const statusIcons: Record<ItemStatus, ReactNode> = {
  pending:  <Clock3      className="h-3.5 w-3.5" />,
  approved: <CheckCircle2 className="h-3.5 w-3.5" />,
  returned: <RotateCcw   className="h-3.5 w-3.5" />,
  rejected: <XCircle     className="h-3.5 w-3.5" />,
};

const itemDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export function ItemCard({ item, viewerId, showStatus = false, onClaimAction }: ItemCardProps) {
  const [claimOpen, setClaimOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canClaim = Boolean(
    onClaimAction && viewerId && viewerId !== item.user_id && item.status === "approved"
  );

  async function submitClaim() {
    if (!onClaimAction || !message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onClaimAction(item.id, message.trim());
      setMessage("");
      setClaimOpen(false);
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Could not submit claim.");
    } finally {
      setSubmitting(false);
    }
  }

  const st = showStatus ? statusStyles[item.status] : null;

  return (
    <article
      className="animate-item card overflow-hidden"
      style={{ borderRadius: 18 }}
    >
      {/* Image */}
      <div className="relative aspect-[4/3]" style={{ background: "var(--cream-dark)" }}>
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt="Lost and found item"
            fill
            sizes="(max-width: 768px) 100vw, 360px"
            className="object-cover"
          />
        ) : (
          <div
            className="flex h-full flex-col items-center justify-center gap-2"
            style={{ color: "var(--ink-muted)" }}
          >
            <span className="text-3xl">📦</span>
            <span className="text-xs font-medium">No photo</span>
          </div>
        )}

        {/* Status badge overlaid on image */}
        {showStatus && st ? (
          <span
            className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold capitalize shadow-sm"
            style={{
              background: st.bg,
              color: st.text,
              border: `1px solid ${st.border}`,
            }}
          >
            {statusIcons[item.status]}
            {item.status}
          </span>
        ) : null}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)", fontFamily: "Nunito, sans-serif" }}>
          {item.description}
        </p>

        <div className="flex items-center justify-between gap-3">
          <time
            dateTime={item.created_at}
            className="text-xs"
            style={{ color: "var(--ink-muted)" }}
          >
            {itemDateFormatter.format(new Date(item.created_at))}
          </time>

          {canClaim ? (
            <button
              type="button"
              onClick={() => setClaimOpen((o) => !o)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-white shadow-sm transition hover:opacity-90 active:scale-95"
              style={{
                background: "linear-gradient(135deg, var(--terracotta) 0%, var(--terra-light) 100%)",
              }}
            >
              <Hand className="h-4 w-4" />
              This is mine!
            </button>
          ) : null}
        </div>

        {/* Claim form */}
        {claimOpen ? (
          <div
            className="space-y-3 border-t pt-3"
            style={{ borderColor: "var(--cream-dark)" }}
          >
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Describe why this item is yours…"
              className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none transition"
              style={{
                borderColor: "var(--sand)",
                background: "var(--cream)",
                color: "var(--ink)",
                fontFamily: "Nunito, sans-serif",
              }}
            />
            {error ? (
              <p className="text-xs font-medium" style={{ color: "var(--rose-warm)" }}>
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClaimOpen(false)}
                className="h-9 rounded-full border px-4 text-sm font-semibold transition hover:opacity-70"
                style={{ borderColor: "var(--sand)", color: "var(--ink-soft)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitClaim}
                disabled={submitting || !message.trim()}
                className="h-9 rounded-full px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, var(--moss) 0%, #6aaa7a 100%)",
                }}
              >
                {submitting ? "Sending…" : "Send claim"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
