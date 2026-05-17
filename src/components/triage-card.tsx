"use client";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Sparkles, Archive, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion as motionTokens } from "@/styles/motion-tokens";
import type { MessageRow } from "@/lib/db/schema";
import type { Bucket } from "@/lib/types/message";
import { archiveMessage, deleteMessage } from "@/lib/actions/message-actions";
import { toast } from "sonner";

type DocWithViewTransition = Document & {
  startViewTransition?: (cb: () => void) => unknown;
};

interface Props {
  message: MessageRow;
}

const STRIPE_COLOR: Record<Bucket | "unclassified", string> = {
  needs_reply: "#0066ff",
  fyi: "#0891b2",
  newsletter: "#ea580c",
  noise: "#64748b",
  unclassified: "#cbd5e1",
};

const LABEL_PILL = "rounded-full border border-aiAccentBorder bg-aiAccentSoft px-2 py-0.5 text-[10px] font-medium tracking-wide text-aiAccentDeep";

export function TriageCard({ message }: Props) {
  const router = useRouter();
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-150, 0, 150], [0.4, 1, 0.4]);
  const [pending, setPending] = useState<"archive" | "delete" | null>(null);
  const href = `/thread/${encodeURIComponent(message.threadId)}`;

  function navigate(e: React.MouseEvent<HTMLAnchorElement>) {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    const doc =
      typeof document !== "undefined" ? (document as DocWithViewTransition) : null;
    if (doc?.startViewTransition) {
      doc.startViewTransition(() => router.push(href));
    } else {
      router.push(href);
    }
  }

  async function handleArchive() {
    setPending("archive");
    try {
      await archiveMessage(message);
      toast.success("Archived");
    } catch (e) {
      toast.error(
        "Archive failed: " + (e instanceof Error ? e.message : "unknown"),
      );
      setPending(null);
    }
  }

  async function handleDelete() {
    setPending("delete");
    try {
      await deleteMessage(message);
      toast.success("Deleted");
    } catch (e) {
      toast.error(
        "Delete failed: " + (e instanceof Error ? e.message : "unknown"),
      );
      setPending(null);
    }
  }

  const aiThinking = !message.bucket;
  const stripeColor = STRIPE_COLOR[message.bucket ?? "unclassified"];
  const unread = message.flags.unread;

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
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={motionTokens.springCard}
      className="relative group"
      whileHover={{ y: -1, scale: 1.005 }}
    >
      <motion.div
        {...(aiThinking
          ? {
              animate: { backgroundPosition: ["0% 0%", "100% 0%"] },
              transition: {
                duration: 2.2,
                repeat: Infinity,
                ease: "linear" as const,
              },
              style: {
                backgroundImage:
                  "linear-gradient(90deg, transparent 0%, rgba(0,102,255,0.10) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
              },
            }
          : {})}
        className={cn("rounded-card", aiThinking && "ring-1 ring-aiAccent/20")}
      >
        <a
          href={href}
          onClick={navigate}
          className={cn(
            "relative block overflow-hidden rounded-card border border-cardBorder bg-card p-4 pl-5 shadow-card transition-all duration-200",
            "hover:shadow-cardHover hover:border-aiAccent/30",
            pending && "opacity-50 pointer-events-none",
          )}
          aria-label={`${message.bucket ?? "unclassified"}: ${message.subject} from ${message.from.email}`}
        >
          {/* Bucket accent stripe — 3px along the left edge */}
          <span
            aria-hidden
            className="absolute left-0 top-0 h-full w-[3px] rounded-l-card"
            style={{
              background: stripeColor,
              opacity: aiThinking ? 0.35 : 1,
            }}
          />

          <div className="flex items-baseline justify-between gap-3">
            <span
              className={cn(
                "truncate text-sm",
                unread
                  ? "font-semibold text-textPrimary"
                  : "font-normal text-textSecondary",
              )}
            >
              {message.from.name ?? message.from.email}
              {unread && (
                <span
                  aria-hidden
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-aiAccent align-middle"
                />
              )}
            </span>
            <span className="ml-auto shrink-0 font-mono text-[11px] text-textDim">
              {formatTime(message.receivedAt)}
            </span>
          </div>
          <h3
            className={cn(
              "mt-1 text-base leading-tight",
              unread
                ? "font-semibold text-textPrimary"
                : "text-textSecondary",
            )}
          >
            {message.subject}
          </h3>
          {message.bucket ? (
            <p className="mt-2 flex items-start gap-1.5 font-display text-[13px] italic leading-snug text-aiAccentDeep">
              <Sparkles
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-aiAccent"
                aria-hidden
              />
              <span>{message.snippet || "(no summary yet)"}</span>
            </p>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 font-display text-[13px] italic text-textMuted">
              <Sparkles
                className="h-4 w-4 flex-shrink-0 animate-pulse text-aiAccent"
                aria-hidden
              />
              <span>Triaging…</span>
            </p>
          )}
          {message.labels.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {message.labels.slice(0, 3).map((l) => (
                <span key={l} className={LABEL_PILL}>
                  {l}
                </span>
              ))}
              {message.labels.length > 3 && (
                <span className="text-[10px] text-textDim">
                  +{message.labels.length - 3}
                </span>
              )}
            </div>
          )}
        </a>

        {/* Desktop hover actions — Archive + Delete buttons visible on hover.
            Mobile keeps the swipe gestures (no hover state on touch). */}
        <div
          className={cn(
            "pointer-events-none absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity duration-150",
            "group-hover:pointer-events-auto group-hover:opacity-100",
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleArchive();
            }}
            disabled={pending !== null}
            aria-label="Archive"
            title="Archive"
            className="rounded-md border border-cardBorder bg-canvasSecondary p-1.5 text-textMuted shadow-card transition-colors hover:border-aiAccent hover:text-aiAccent disabled:opacity-50"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleDelete();
            }}
            disabled={pending !== null}
            aria-label="Delete"
            title="Delete"
            className="rounded-md border border-cardBorder bg-canvasSecondary p-1.5 text-textMuted shadow-card transition-colors hover:border-error hover:text-error disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>

      {pending === "archive" && (
        <div className="absolute inset-0 flex items-center justify-end pr-6 pointer-events-none">
          <Archive className="h-5 w-5 text-aiAccent" />
        </div>
      )}
      {pending === "delete" && (
        <div className="absolute inset-0 flex items-center justify-start pl-6 pointer-events-none">
          <Trash2 className="h-5 w-5 text-error" />
        </div>
      )}
    </motion.div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
