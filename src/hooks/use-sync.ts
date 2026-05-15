"use client";
import { useEffect, useState } from "react";
import { startSyncLoop, runOnce } from "@/lib/sync/sync-loop";

interface TickInfo {
  processed: number;
  cacheHitRate: number;
  errors: string[];
  aiError?: { message: string; cause: string };
  lastAt: number;
}

export interface UseSyncOptions {
  intervalSec?: number;
  provider?: "anthropic" | "openai" | "gemini";
  byok?: string;
  /** When false, the sync loop is paused. Used to avoid firing AI calls
   *  before settings have loaded (which would otherwise default to Anthropic
   *  with no key and produce a spurious auth error). */
  enabled?: boolean;
}

export function useSync(opts: UseSyncOptions = {}): TickInfo | null {
  const [info, setInfo] = useState<TickInfo | null>(null);

  useEffect(() => {
    if (typeof indexedDB === "undefined") return;
    if (opts.enabled === false) return;
    // Don't start the loop without an explicit provider — prevents the
    // initial-render race that posts a request with no provider and no key.
    if (!opts.provider) return;
    const loopOpts = {
      ...(opts.intervalSec ? { intervalSec: opts.intervalSec } : {}),
      ...(opts.provider ? { provider: opts.provider } : {}),
      ...(opts.byok ? { byok: opts.byok } : {}),
      onTick: (t: {
        processed: number;
        cacheHitRate: number;
        errors: string[];
        aiError?: { message: string; cause: string };
      }) =>
        setInfo({
          processed: t.processed,
          cacheHitRate: t.cacheHitRate,
          errors: t.errors,
          ...(t.aiError ? { aiError: t.aiError } : {}),
          lastAt: Date.now(),
        }),
    };
    const stop = startSyncLoop(loopOpts);

    const onFocus = () => {
      if (document.visibilityState === "visible") {
        void runOnce(loopOpts);
      }
    };
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [opts.intervalSec, opts.provider, opts.byok, opts.enabled]);

  return info;
}
