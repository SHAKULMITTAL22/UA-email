"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, AlertCircle, Plus, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AppLoader } from "@/components/app-loader";
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

interface TriagedInboxViewProps {
  activeAccountId?: string | "unified";
  searchQuery?: string;
  onAddAccount?: () => void;
}

export function TriagedInboxView({ activeAccountId, searchQuery = "", onAddAccount }: TriagedInboxViewProps) {
  const accounts = useAccounts();
  const triaged = useTriagedInbox(activeAccountId);
  const { settings } = useSettings();
  const byokKey = settings.byok[settings.llmProvider];
  const sync = useSync({
    intervalSec: settings.syncIntervalSec,
    provider: settings.llmProvider,
    ...(byokKey ? { byok: byokKey } : {}),
  });

  const accountsLoading = accounts === undefined;
  const noAccounts = (accounts?.length ?? 0) === 0;
  const hasAccounts = !accountsLoading && !noAccounts;
  const syncing = hasAccounts && (!sync || sync.processed === 0);

  const lastToastedAt = useRef<number>(0);
  useEffect(() => {
    if (!sync || sync.processed === 0) return;
    if (sync.lastAt === lastToastedAt.current) return;
    lastToastedAt.current = sync.lastAt;
    toast.success(
      `Triaged ${sync.processed} message${sync.processed === 1 ? "" : "s"} · cache hit ${(sync.cacheHitRate * 100).toFixed(0)}%`,
    );
  }, [sync]);

  const [loadingOlder, setLoadingOlder] = useState(false);
  const [bucketLimits, setBucketLimits] = useState<Record<Bucket | "unclassified", number>>({
    needs_reply: 10,
    fyi: 10,
    newsletter: 10,
    noise: 10,
    unclassified: 10,
  });
  async function handleLoadOlder() {
    if (!accounts || accounts.length === 0) return;
    setLoadingOlder(true);
    try {
      const { loadOlder } = await import("@/lib/sync/sync-engine");
      const targets =
        activeAccountId && activeAccountId !== "unified"
          ? accounts.filter((a) => a.id === activeAccountId)
          : accounts;
      let total = 0;
      for (const acct of targets) {
        const r = await loadOlder(acct);
        total += r.fetched;
      }
      toast.success(
        total > 0
          ? `Fetched ${total} older message${total === 1 ? "" : "s"}`
          : "No older messages found",
      );
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLoadingOlder(false);
    }
  }

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

  if (accountsLoading) {
    return <AppLoader />;
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-textPrimary">Your inbox, triaged</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-textMuted">
            <Sparkles
              className={cn("h-3.5 w-3.5 text-aiAccent", syncing && "animate-pulse")}
              aria-hidden
            />
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

      {sync?.aiError ? (
        <div className="flex items-start gap-2 rounded-card border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200" role="alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium">AI triage failed ({sync.aiError.cause}).</div>
            <p className="mt-1 text-xs text-amber-200/80">{sync.aiError.message}</p>
            <p className="mt-1 text-xs text-amber-200/70">
              {sync.aiError.cause === "auth" && "Check your API key in Settings."}
              {sync.aiError.cause === "rate_limit" && "Quota hit. Try a different LLM provider in Settings."}
              {sync.aiError.cause === "schema" && "The model returned malformed JSON. Try a different model."}
              {sync.aiError.cause === "network" && "Provider is unreachable. Will retry next tick."}
            </p>
          </div>
        </div>
      ) : null}

      {noAccounts && (
        <motion.div
          initial={{ y: 12 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-card border border-cardBorder bg-gradient-to-br from-card via-card to-aiAccent/5 p-8 sm:p-12 text-center space-y-6"
          role="status"
        >
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-aiAccent/15 border border-aiAccent/30">
            <Sparkles className="h-6 w-6 text-aiAccent" aria-hidden />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl text-textPrimary">Triage your inbox in 5 seconds.</h2>
            <p className="text-sm text-textMuted max-w-md mx-auto leading-relaxed">
              Connect any email account and watch AI sort today&apos;s mail into{" "}
              <span className="text-bucket-needsReply">Needs reply</span>,{" "}
              <span className="text-bucket-fyi">FYI</span>,{" "}
              <span className="text-bucket-newsletter">Newsletters</span>, and{" "}
              <span className="text-bucket-noise">Noise</span> — with one-line summaries and pre-drafted replies on every important thread.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button onClick={() => onAddAccount?.()} className="min-w-[180px]">
              <Plus className="h-4 w-4 mr-1.5" />
              Add an account
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const { loadDemoInbox } = await import("@/lib/demo/load-demo");
                await loadDemoInbox();
                toast.success("Demo inbox loaded — 12 triaged emails ready");
              }}
              className="min-w-[180px]"
            >
              <Sparkles className="h-4 w-4 mr-1.5 text-aiAccent" />
              Try demo inbox
            </Button>
          </div>
          <p className="text-xs text-textDim">
            IMAP works for Gmail / Outlook / Yahoo / AOL with an app password. Or load the demo above — no setup, no keys.
          </p>
        </motion.div>
      )}

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
                <span className="flex items-baseline gap-1.5 text-xs text-textDim">
                  {syncing && (
                    <span className="text-aiAccent animate-pulse" aria-hidden>…</span>
                  )}
                  <span>{b.messages.length}</span>
                </span>
              </div>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {b.messages.slice(0, bucketLimits[b.bucket]).map((m) => (
                    <TriageCard key={m.id} message={m} />
                  ))}
                </AnimatePresence>
                {b.messages.length === 0 && (
                  <p className="text-sm text-textMuted italic">Nothing in this bucket yet.</p>
                )}
                {b.messages.length > bucketLimits[b.bucket] && (
                  <button
                    onClick={() =>
                      setBucketLimits((prev) => ({
                        ...prev,
                        [b.bucket]: prev[b.bucket] + 25,
                      }))
                    }
                    className="text-xs text-aiAccent hover:text-aiAccent/80 transition-colors w-full text-left pl-3 pt-1"
                  >
                    Show {Math.min(25, b.messages.length - bucketLimits[b.bucket])} more (of {b.messages.length} total)
                  </button>
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

        {!noAccounts && accounts && accounts.length > 0 && (
          <div className="flex justify-center pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleLoadOlder()}
              disabled={loadingOlder}
            >
              <RotateCw className={cn("h-3.5 w-3.5 mr-1.5", loadingOlder && "animate-spin")} />
              {loadingOlder ? "Loading older messages…" : "Load older messages"}
            </Button>
          </div>
        )}
      </div>

    </div>
  );
}
