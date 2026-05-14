"use client";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Sparkles, Archive, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion as motionTokens } from "@/styles/motion-tokens";
import type { MessageRow } from "@/lib/db/schema";
import type { Bucket } from "@/lib/types/message";
import { archiveMessage, deleteMessage } from "@/lib/actions/message-actions";
import { toast } from "sonner";

interface Props { message: MessageRow }

const STRIPE_COLOR: Record<Bucket | "unclassified", string> = {
  needs_reply: "#d4ff3a",
  fyi: "#7dd3fc",
  newsletter: "#fbbf77",
  noise: "#64748b",
  unclassified: "rgba(255,255,255,0.18)",
};

export function TriageCard({ message }: Props) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-150, 0, 150], [0.4, 1, 0.4]);
  const [pending, setPending] = useState<"archive" | "delete" | null>(null);

  async function handleArchive() {
    setPending("archive");
    try {
      await archiveMessage(message);
      toast.success("Archived");
    } catch (e) {
      toast.error("Archive failed: " + (e instanceof Error ? e.message : "unknown"));
      setPending(null);
    }
  }

  async function handleDelete() {
    setPending("delete");
    try {
      await deleteMessage(message);
      toast.success("Deleted");
    } catch (e) {
      toast.error("Delete failed: " + (e instanceof Error ? e.message : "unknown"));
      setPending(null);
    }
  }

  const aiThinking = !message.bucket;
  const stripeColor = STRIPE_COLOR[message.bucket ?? "unclassified"];

  return (
    <motion.div
      layout
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      style={{ x, opacity }}
      onDragEnd={(_, info) => {
        if (info.offset.x < -120) void handleArchive();
        else if (info.offset.x > 120) void handleDelete();
      }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={motionTokens.springCard}
      className="relative group"
      whileHover={{ y: -1 }}
    >
      <motion.div
        {...(aiThinking
          ? {
              animate: { backgroundPosition: ["0% 0%", "100% 0%"] },
              transition: { duration: 2.2, repeat: Infinity, ease: "linear" as const },
              style: {
                backgroundImage:
                  "linear-gradient(90deg, transparent 0%, rgba(212,255,58,0.10) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
              },
            }
          : {})}
        className={cn("rounded-card", aiThinking && "ring-1 ring-aiAccent/20")}
      >
        <Link
          href={`/thread/${encodeURIComponent(message.threadId)}`}
          className={cn(
            "glass-card relative block overflow-hidden rounded-card p-4 pl-5",
            "hover:shadow-[0_4px_24px_-8px_rgba(212,255,58,0.18)]",
            pending && "opacity-50 pointer-events-none",
          )}
          aria-label={`${message.bucket ?? "unclassified"}: ${message.subject} from ${message.from.email}`}
        >
          {/* Bucket accent stripe — hairline along the left edge */}
          <span
            aria-hidden
            className="absolute left-0 top-0 h-full w-1"
            style={{
              background: stripeColor,
              boxShadow: `0 0 12px -2px ${stripeColor}`,
              opacity: aiThinking ? 0.35 : 0.9,
            }}
          />

          <div className="flex items-baseline justify-between gap-3">
            <span
              className={cn(
                "truncate text-sm",
                message.flags.unread
                  ? "font-semibold text-textPrimary"
                  : "font-normal text-textMuted",
              )}
            >
              {message.from.name ?? message.from.email}
            </span>
            <span className="ml-auto shrink-0 rounded-full bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-textDim">
              {formatTime(message.receivedAt)}
            </span>
          </div>
          <h3
            className={cn(
              "mt-1 text-base leading-tight",
              message.flags.unread
                ? "font-semibold text-textPrimary"
                : "text-textMuted",
            )}
          >
            {message.subject}
          </h3>
          {message.bucket ? (
            <p className="mt-2 flex items-start gap-1.5 font-display text-[13px] italic leading-snug text-textMuted">
              <Sparkles
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-aiAccent"
                aria-hidden
              />
              <span>{message.snippet || "(no summary yet)"}</span>
            </p>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 font-display text-[13px] italic text-textDim">
              <Sparkles
                className="h-4 w-4 flex-shrink-0 animate-pulse text-aiAccent"
                aria-hidden
              />
              <span>Triaging…</span>
            </p>
          )}
          {message.labels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {message.labels.slice(0, 3).map((l) => (
                <span
                  key={l}
                  className="rounded border border-aiAccentBorder bg-aiAccentSoft px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-aiAccent"
                >
                  {l}
                </span>
              ))}
              {message.labels.length > 3 && (
                <span className="text-[10px] text-textDim">+{message.labels.length - 3}</span>
              )}
            </div>
          )}
        </Link>
      </motion.div>

      {pending === "archive" && (
        <div className="absolute inset-0 flex items-center justify-end pr-6 pointer-events-none">
          <Archive className="h-5 w-5 text-aiAccent" />
        </div>
      )}
      {pending === "delete" && (
        <div className="absolute inset-0 flex items-center justify-start pl-6 pointer-events-none">
          <Trash2 className="h-5 w-5 text-red-400" />
        </div>
      )}
    </motion.div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
