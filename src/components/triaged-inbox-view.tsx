"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Inbox as InboxIcon, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { motion as motionTokens } from "@/styles/motion-tokens";
import { useSync } from "@/hooks/use-sync";
import { useTriagedInbox } from "@/hooks/use-triaged-inbox";
import { useAccounts } from "@/hooks/use-accounts";
import { useSettings } from "@/hooks/use-settings";
import { TriageCard } from "@/components/triage-card";
import type { Bucket } from "@/lib/types/message";

const BUCKET_META: Record<Bucket | "unclassified", { label: string; color: string; tag: string }> = {
  needs_reply: { label: "Needs reply", color: "text-bucket-needsReply", tag: "needsReply" },
  fyi:         { label: "FYI", color: "text-bucket-fyi", tag: "fyi" },
  newsletter:  { label: "Newsletters", color: "text-bucket-newsletter", tag: "newsletter" },
  noise:       { label: "Noise", color: "text-bucket-noise", tag: "noise" },
  unclassified:{ label: "Unclassified", color: "text-textMuted", tag: "muted" },
};

export function TriagedInboxView({ activeAccountId, searchQuery = "" }: { activeAccountId?: string | "unified"; searchQuery?: string }) {
  const accounts = useAccounts();
  const triaged = useTriagedInbox(activeAccountId);
  const { settings } = useSettings();
  const byokKey = settings.byok[settings.llmProvider];
  const sync = useSync({
    intervalSec: settings.syncIntervalSec,
    provider: settings.llmProvider,
    ...(byokKey ? { byok: byokKey } : {}),
  });

  const noAccounts = (accounts?.length ?? 0) === 0;

  const filtered = (() => {
    if (!triaged || !searchQuery.trim()) return triaged;
    const q = searchQuery.toLowerCase();
    const bucketMatch = q.match(/bucket:(\S+)/);
    const fromMatch = q.match(/from:(\S+)/);
    const textQ = q.replace(/bucket:\S+/g, "").replace(/from:\S+/g, "").trim();
    return triaged.map((b) => ({
      bucket: b.bucket,
      messages: b.messages.filter((m) =>
        (!bucketMatch || m.bucket === bucketMatch[1]) &&
        (!fromMatch || m.from.email.toLowerCase().includes(fromMatch[1]!)) &&
        (!textQ ||
          m.subject.toLowerCase().includes(textQ) ||
          m.snippet.toLowerCase().includes(textQ) ||
          m.body.toLowerCase().includes(textQ)),
      ),
    }));
  })();

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
        {filtered?.map((b, i) => {
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
                    <TriageCard key={m.id} message={m} />
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
