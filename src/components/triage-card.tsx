"use client";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Sparkles, Archive, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion as motionTokens } from "@/styles/motion-tokens";
import type { MessageRow } from "@/lib/db/schema";
import { archiveMessage, deleteMessage } from "@/lib/actions/message-actions";
import { toast } from "sonner";

interface Props { message: MessageRow }

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
      transition={motionTokens.springReflow}
      className="relative"
    >
      <motion.div
        {...(aiThinking
          ? {
              animate: { backgroundPosition: ["0% 0%", "100% 0%"] },
              transition: { duration: 2.2, repeat: Infinity, ease: "linear" as const },
              style: {
                backgroundImage:
                  "linear-gradient(90deg, transparent 0%, rgba(167,139,250,0.10) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
              },
            }
          : {})}
        className={cn("rounded-card", aiThinking && "ring-1 ring-aiAccent/20")}
      >
        <Link
          href={`/thread/${encodeURIComponent(message.threadId)}`}
          className={cn(
            "block rounded-card border border-cardBorder bg-card backdrop-blur-card p-4 transition-colors hover:border-aiAccent/40",
            pending && "opacity-50 pointer-events-none",
          )}
          aria-label={`${message.bucket ?? "unclassified"}: ${message.subject} from ${message.from.email}`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className={cn("font-medium text-sm truncate", message.flags.unread ? "text-textPrimary" : "text-textMuted")}>
              {message.from.name ?? message.from.email}
            </span>
            <span className="text-xs text-textDim font-mono">{formatTime(message.receivedAt)}</span>
          </div>
          <h3 className={cn("mt-1 text-base leading-tight", message.flags.unread ? "font-semibold text-textPrimary" : "text-textMuted")}>
            {message.subject}
          </h3>
          {message.bucket ? (
            <p className="mt-2 text-sm text-textMuted italic flex items-start gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-aiAccent mt-0.5 flex-shrink-0" aria-hidden />
              <span>{message.snippet || "(no summary yet)"}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-textDim italic flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-aiAccent flex-shrink-0 animate-pulse" aria-hidden />
              <span>Triaging…</span>
            </p>
          )}
          {message.labels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {message.labels.slice(0, 3).map((l) => (
                <span
                  key={l}
                  className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-aiAccent/10 text-aiAccent border border-aiAccent/20"
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
