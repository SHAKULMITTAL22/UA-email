"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Inbox as InboxIcon, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { motion as motionTokens } from "@/styles/motion-tokens";
import { useSync } from "@/hooks/use-sync";
import { useTriagedInbox } from "@/hooks/use-triaged-inbox";
import { useAccounts } from "@/hooks/use-accounts";
import type { Bucket } from "@/lib/types/message";

const BUCKET_META: Record<Bucket | "unclassified", { label: string; color: string; tag: string }> = {
  needs_reply: { label: "Needs reply", color: "text-bucket-needsReply", tag: "needsReply" },
  fyi:         { label: "FYI", color: "text-bucket-fyi", tag: "fyi" },
  newsletter:  { label: "Newsletters", color: "text-bucket-newsletter", tag: "newsletter" },
  noise:       { label: "Noise", color: "text-bucket-noise", tag: "noise" },
  unclassified:{ label: "Unclassified", color: "text-textMuted", tag: "muted" },
};

export function TriagedInboxView({ activeAccountId }: { activeAccountId?: string | "unified" }) {
  const accounts = useAccounts();
  const triaged = useTriagedInbox(activeAccountId);
  const sync = useSync({ intervalSec: 60 });

  const noAccounts = (accounts?.length ?? 0) === 0;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-textPrimary">Your inbox, triaged</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-textMuted">
            <Sparkles className={cn("h-3.5 w-3.5 text-aiAccent", sync && sync.processed > 0 && "animate-pulse")} aria-hidden />
            <span>
              {noAccounts
                ? "Add an account to begin."
                : sync
                  ? `Triaged ${sync.processed} new · cache hit ${(sync.cacheHitRate * 100).toFixed(0)}%`
                  : "Syncing…"}
            </span>
          </p>
        </div>
      </header>

      {sync?.errors.length ? (
        <div className="flex items-start gap-2 rounded-card border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300" role="alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Sync had {sync.errors.length} issue{sync.errors.length === 1 ? "" : "s"}.</div>
            <ul className="mt-1 text-xs text-red-300/80">
              {sync.errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="space-y-6">
        {triaged?.map((b, i) => {
          const meta = BUCKET_META[b.bucket];
          if (b.bucket === "unclassified" && b.messages.length === 0) return null;

          return (
            <motion.section
              key={b.bucket}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: motionTokens.duration.base, delay: i * 0.04, ease: motionTokens.ease.out }}
              aria-labelledby={`bucket-${b.bucket}`}
            >
              <div className="mb-2 flex items-baseline justify-between">
                <h2 id={`bucket-${b.bucket}`} className={cn("text-xs uppercase tracking-[2px]", meta.color)}>
                  {`— ${meta.label}`}
                </h2>
                <span className="text-xs text-textDim">{b.messages.length}</span>
              </div>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {b.messages.slice(0, 10).map((m) => (
                    <motion.article
                      key={m.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={motionTokens.springReflow}
                      className="rounded-card border border-cardBorder bg-card backdrop-blur-card p-4"
                      aria-label={`${meta.label}: ${m.subject} from ${m.from.email}`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium text-sm text-textPrimary truncate">{m.from.name ?? m.from.email}</span>
                        <span className="text-xs text-textDim font-mono">{formatTime(m.receivedAt)}</span>
                      </div>
                      <h3 className="mt-1 text-base font-medium text-textPrimary leading-tight">{m.subject}</h3>
                      {m.bucket && (
                        <p className="mt-2 text-sm text-textMuted italic flex items-start gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-aiAccent mt-0.5 flex-shrink-0" aria-hidden />
                          <span>{m.snippet || "(no summary yet)"}</span>
                        </p>
                      )}
                    </motion.article>
                  ))}
                </AnimatePresence>
                {b.messages.length === 0 && (
                  <p className="text-sm text-textMuted italic">Nothing in this bucket yet.</p>
                )}
              </div>
            </motion.section>
          );
        }) ?? (
          <>
            <Skeleton className="h-20 w-full rounded-card bg-card" />
            <Skeleton className="h-20 w-full rounded-card bg-card opacity-60" />
          </>
        )}
      </div>

      {noAccounts && (
        <div className="rounded-card border border-cardBorder bg-card p-6 text-center" role="status">
          <InboxIcon className="h-8 w-8 text-aiAccent mx-auto mb-2" aria-hidden />
          <p className="text-sm text-textMuted">
            No accounts yet — click <strong>Unified Inbox</strong> in the header, then <strong>Add account</strong>.
          </p>
        </div>
      )}
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
