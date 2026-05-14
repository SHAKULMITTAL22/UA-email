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
}

export function useSync(opts: UseSyncOptions = {}): TickInfo | null {
  const [info, setInfo] = useState<TickInfo | null>(null);

  useEffect(() => {
    if (typeof indexedDB === "undefined") return;
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
  }, [opts.intervalSec, opts.provider, opts.byok]);

  return info;
}
