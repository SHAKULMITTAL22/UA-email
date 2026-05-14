"use client";
import { useEffect, useState } from "react";
import { startSyncLoop } from "@/lib/sync/sync-loop";

interface TickInfo {
  processed: number;
  cacheHitRate: number;
  errors: string[];
  lastAt: number;
}

export function useSync(opts: { intervalSec?: number } = {}): TickInfo | null {
  const [info, setInfo] = useState<TickInfo | null>(null);

  useEffect(() => {
    if (typeof indexedDB === "undefined") return;
    const stop = startSyncLoop({
      ...(opts.intervalSec ? { intervalSec: opts.intervalSec } : {}),
      onTick: (t) => setInfo({ ...t, lastAt: Date.now() }),
    });

    const onFocus = () => {
      if (document.visibilityState === "visible") {
        void import("@/lib/sync/sync-loop").then((m) => m.runOnce());
      }
    };
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [opts.intervalSec]);

  return info;
}
