"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { StateInboxView } from "@/components/state-inbox-view";
import { SpotlightCard } from "@/components/spotlight-card";
import { AnimatedCounter } from "@/components/animated-counter";
import { useMagnetic } from "@/hooks/use-magnetic";
import type { Bucket } from "@/lib/types/message";
import type { ActiveFilter } from "@/components/app-shell";

const BUCKET_META: Record<
  Bucket | "unclassified",
  {
    label: string;
    blurb: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  needs_reply: {
    label: "Needs reply",
    blurb: "Messages waiting on a response from you.",
    textColor: "text-bucket-needsReply",
    bgColor: "bg-bucketSurface-needsReply",
    borderColor: "border-aiAccentBorder",
  },
  fyi: {
    label: "FYI",
    blurb: "Updates worth scanning — no reply needed.",
    textColor: "text-bucket-fyi",
    bgColor: "bg-bucketSurface-fyi",
    borderColor: "border-bucket-fyi/30",
  },
  newsletter: {
    label: "Newsletters",
    blurb: "Subscriptions and digests, batched for later.",
    textColor: "text-bucket-newsletter",
    bgColor: "bg-bucketSurface-newsletter",
    borderColor: "border-bucket-newsletter/30",
  },
  noise: {
    label: "Noise",
    blurb: "Promos, receipts, and noise — archive safely.",
    textColor: "text-bucket-noise",
    bgColor: "bg-bucketSurface-noise",
    borderColor: "border-bucket-noise/30",
  },
  unclassified: {
    label: "Unclassified",
    blurb: "Awaiting AI triage.",
    textColor: "text-textMuted",
    bgColor: "bg-cardHover",
    borderColor: "border-cardBorder",
  },
};

interface TriagedInboxViewProps {
  activeAccountId?: string | "unified";
  searchQuery?: string;
  filter?: ActiveFilter;
  onAddAccount?: () => void;
}

export function TriagedInboxView({
  activeAccountId,
  searchQuery = "",
  filter = "all",
  onAddAccount,
}: TriagedInboxViewProps) {
  const accounts = useAccounts();
  const triaged = useTriagedInbox(activeAccountId);
  const { settings } = useSettings();
  const addAccountMagnetRef = useMagnetic<HTMLButtonElement>();
  const demoMagnetRef = useMagnetic<HTMLButtonElement>();
  const byokKey = settings.byok[settings.llmProvider];
  // Only start the sync loop once we have a key for the active provider.
  // This prevents the initial-render race that previously posted requests
  // with no provider/byok and produced spurious "Anthropic API key not
  // configured" errors before settings loaded from IndexedDB.
  const aiReady = Boolean(byokKey);
  const sync = useSync({
    intervalSec: settings.syncIntervalSec,
    provider: settings.llmProvider,
    enabled: aiReady,
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
  const [bucketLimits, setBucketLimits] = useState<
    Record<Bucket | "unclassified", number>
  >({
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

  const filtered = useMemo(() => {
    if (!triaged) return triaged;
    const q = searchQuery.toLowerCase();
    const bucketMatch = q.match(/bucket:(\S+)/);
    const fromMatch = q.match(/from:(\S+)/);
    const textQ = q
      .replace(/bucket:\S+/g, "")
      .replace(/from:\S+/g, "")
      .trim();
    return triaged.map((b) => ({
      bucket: b.bucket,
      messages: b.messages.filter(
        (m) =>
          (!bucketMatch || m.bucket === bucketMatch[1]) &&
          (!fromMatch || m.from.email.toLowerCase().includes(fromMatch[1]!)) &&
          (!textQ ||
            m.subject.toLowerCase().includes(textQ) ||
            m.snippet.toLowerCase().includes(textQ) ||
            m.body.toLowerCase().includes(textQ)),
      ),
    }));
  }, [triaged, searchQuery]);

  // Apply sidebar filter — when a bucket filter, show only that bucket
  // section. (archived/trashed render a different view entirely, handled below.)
  const visibleBuckets = useMemo(() => {
    if (!filtered) return filtered;
    if (filter === "all") return filtered;
    if (filter === "archived" || filter === "trashed") return filtered;
    return filtered.filter((b) => b.bucket === filter);
  }, [filtered, filter]);

  if (accountsLoading) {
    return <AppLoader />;
  }

  // Archived / Trash filters render a dedicated state view (not the triaged
  // bucket UI). All other filters fall through to the regular inbox render.
  if (filter === "archived" || filter === "trashed") {
    return (
      <StateInboxView
        state={filter}
        {...(activeAccountId !== undefined ? { activeAccountId } : {})}
        searchQuery={searchQuery}
      />
    );
  }

  const isBucketFilter =
    filter === "needs_reply" ||
    filter === "fyi" ||
    filter === "newsletter" ||
    filter === "noise" ||
    filter === "unclassified";
  const isSingleBucket = isBucketFilter && visibleBuckets && visibleBuckets.length > 0;
  const singleBucketMeta = isSingleBucket && isBucketFilter ? BUCKET_META[filter] : null;
  const singleBucketCount = isSingleBucket
    ? (visibleBuckets[0]?.messages.length ?? 0)
    : 0;

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-3">
        {isSingleBucket && singleBucketMeta ? (
          <>
            <h1
              className={cn(
                "font-display text-4xl leading-[1.05] tracking-tight text-textPrimary sm:text-5xl",
              )}
            >
              <span className={singleBucketMeta.textColor}>
                {singleBucketMeta.label}
              </span>{" "}
              <span className="text-textDim italic">
                · <AnimatedCounter value={singleBucketCount} />
              </span>
            </h1>
            <p className="text-sm text-textMuted">{singleBucketMeta.blurb}</p>
          </>
        ) : (
          <>
            <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-textPrimary sm:text-5xl">
              Your inbox,{" "}
              <span className="italic text-aiAccent underline decoration-aiAccent decoration-2 underline-offset-[6px]">
                triaged
              </span>
              .
            </h1>
            <p className="flex items-center gap-2 text-sm text-textMuted">
              {syncing ? (
                <span className="relative inline-flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aiAccent opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-aiAccent" />
                </span>
              ) : (
                <Sparkles
                  className="h-3.5 w-3.5 text-aiAccent"
                  aria-hidden
                />
              )}
              <span>
                {noAccounts
                  ? "Add an account to begin."
                  : sync
                    ? `Triaged ${sync.processed} new · cache hit ${(sync.cacheHitRate * 100).toFixed(0)}%`
                    : "Syncing your inbox…"}
              </span>
            </p>
          </>
        )}
      </header>

      {sync?.errors.length ? (
        <div
          className="flex items-start gap-2 rounded-card border border-red-300 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">
              Sync had {sync.errors.length} issue
              {sync.errors.length === 1 ? "" : "s"}.
            </div>
            <ul className="mt-1 text-xs text-red-600/90">
              {sync.errors.slice(0, 3).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {sync?.aiError ? (
        <div
          className="flex items-start gap-2 rounded-card border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium">
              AI triage failed ({sync.aiError.cause}).
            </div>
            <p className="mt-1 text-xs text-amber-700/90">{sync.aiError.message}</p>
            <p className="mt-1 text-xs text-amber-700/80">
              {sync.aiError.cause === "auth" && "Check your API key in Settings."}
              {sync.aiError.cause === "rate_limit" &&
                "Quota hit. Try a different LLM provider in Settings."}
              {sync.aiError.cause === "schema" &&
                "The model returned malformed JSON. Try a different model."}
              {sync.aiError.cause === "network" &&
                "Provider is unreachable. Will retry next tick."}
            </p>
          </div>
        </div>
      ) : null}

      {hasAccounts && !aiReady ? (
        <div
          className="flex items-start gap-2 rounded-card border border-aiAccentBorder bg-aiAccentSoft p-3 text-sm text-aiAccentDeep"
          role="status"
        >
          <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium">AI triage is paused.</div>
            <p className="mt-1 text-xs text-aiAccentDeep/80">
              No API key set for{" "}
              <strong>
                {settings.llmProvider === "anthropic"
                  ? "Anthropic Claude"
                  : settings.llmProvider === "openai"
                    ? "OpenAI"
                    : "Google Gemini"}
              </strong>
              . Add one in Settings -&gt; Save &amp; verify, and triage will start
              automatically.
            </p>
          </div>
        </div>
      ) : null}

      {noAccounts && (
        <SpotlightCard className="glass-card rounded-card">
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              duration: motionTokens.duration.dramatic,
              ease: motionTokens.ease.out,
            }}
            className="relative p-10 sm:p-14 text-center"
            role="status"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-56 w-2/3 rounded-full bg-aiAccent/10 blur-3xl"
            />

            <div className="relative space-y-8">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-aiAccentBorder bg-aiAccentSoft">
                <Sparkles className="h-7 w-7 text-aiAccent" aria-hidden />
              </div>
              <div className="space-y-3">
                <h2 className="font-display text-3xl leading-[1.05] text-textPrimary sm:text-4xl">
                  One <span className="italic text-aiAccent">AI call</span>{" "}
                  <br className="hidden sm:block" />
                  to clear your inbox.
                </h2>
                <p className="mx-auto max-w-md text-sm leading-relaxed text-textSecondary">
                  Connect any email account and watch AI sort today&apos;s mail
                  into{" "}
                  <span className="text-bucket-needsReply font-medium">
                    Needs reply
                  </span>
                  ,{" "}
                  <span className="text-bucket-fyi font-medium">FYI</span>,{" "}
                  <span className="text-bucket-newsletter font-medium">
                    Newsletters
                  </span>
                  , and{" "}
                  <span className="text-bucket-noise font-medium">Noise</span> —
                  with one-line summaries and pre-drafted replies on every
                  important thread.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
                <Button
                  ref={addAccountMagnetRef}
                  onClick={() => onAddAccount?.()}
                  className="min-w-[180px] transition-transform"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add an account
                </Button>
                <Button
                  ref={demoMagnetRef}
                  variant="outline"
                  onClick={async () => {
                    const { loadDemoInbox } = await import("@/lib/demo/load-demo");
                    await loadDemoInbox();
                    toast.success("Demo inbox loaded — 12 triaged emails ready");
                  }}
                  className="min-w-[180px] transition-transform"
                >
                  <Sparkles className="h-4 w-4 mr-1.5 text-aiAccent" />
                  Try demo inbox
                </Button>
              </div>
              <p className="text-xs text-textMuted">
                IMAP works for Gmail / Outlook / Yahoo / AOL with an app
                password. Or load the demo above — no setup, no keys.
              </p>
            </div>
          </motion.div>
        </SpotlightCard>
      )}

      <div className="space-y-8">
        {visibleBuckets?.map((b, i) => {
          const meta = BUCKET_META[b.bucket];
          if (b.bucket === "unclassified" && b.messages.length === 0)
            return null;
          // In single-bucket view, hide the section header (it's already h1).
          const showHeader = filter === "all";

          return (
            <motion.section
              key={b.bucket}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: motionTokens.duration.base,
                delay: i * 0.04,
                ease: motionTokens.ease.out,
              }}
              aria-labelledby={`bucket-${b.bucket}`}
            >
              {showHeader && (
                <div className="section-rule">
                  <h2
                    id={`bucket-${b.bucket}`}
                    className={cn(
                      "text-[11px] font-medium uppercase tracking-[2.5px]",
                      meta.textColor,
                    )}
                  >
                    {meta.label}
                  </h2>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px]",
                      meta.bgColor,
                      meta.borderColor,
                      meta.textColor,
                    )}
                  >
                    {syncing && (
                      <span
                        className="h-1 w-1 animate-pulse rounded-full bg-current"
                        aria-hidden
                      />
                    )}
                    <AnimatedCounter value={b.messages.length} />
                  </span>
                </div>
              )}
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {b.messages.slice(0, bucketLimits[b.bucket]).map((m) => (
                    <TriageCard key={m.id} message={m} />
                  ))}
                </AnimatePresence>
                {b.messages.length === 0 && (
                  <p className="text-sm text-textMuted italic">
                    Nothing in this bucket yet.
                  </p>
                )}
                {b.messages.length > bucketLimits[b.bucket] && (
                  <button
                    onClick={() =>
                      setBucketLimits((prev) => ({
                        ...prev,
                        [b.bucket]: prev[b.bucket] + 25,
                      }))
                    }
                    className="w-full pl-3 pt-1 text-left text-xs text-aiAccent transition-colors hover:text-aiAccentDeep"
                  >
                    Show{" "}
                    {Math.min(25, b.messages.length - bucketLimits[b.bucket])}{" "}
                    more (of {b.messages.length} total)
                  </button>
                )}
              </div>
            </motion.section>
          );
        }) ?? (
          <>
            <Skeleton className="h-20 w-full rounded-card skeleton-shimmer" />
            <Skeleton className="h-20 w-full rounded-card skeleton-shimmer opacity-70" />
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
              <RotateCw
                className={cn(
                  "h-3.5 w-3.5 mr-1.5",
                  loadingOlder && "animate-spin",
                )}
              />
              {loadingOlder ? "Loading older messages…" : "Load older messages"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
