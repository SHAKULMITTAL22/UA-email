import { syncAccount } from "@/lib/sync/sync-engine";
import { triageNewMessages } from "@/lib/sync/triage-batcher";
import { listAccounts } from "@/lib/accounts/account-store";

export interface SyncLoopOptions {
  intervalSec?: number;
  provider?: "anthropic" | "openai" | "gemini";
  byok?: string;
  onTick?: (info: { processed: number; cacheHitRate: number; errors: string[] }) => void;
}

let currentTimer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

export async function runOnce(opts: SyncLoopOptions = {}): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const accounts = await listAccounts();
    let totalProcessed = 0;
    let lastHitRate = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      const result = await syncAccount(account);
      if (result.errored) {
        errors.push(`${account.email}: ${result.errorReason ?? "unknown"}`);
        continue;
      }
      if (result.newMessages.length > 0) {
        const triage = await triageNewMessages(result.newMessages, {
          ...(opts.provider ? { provider: opts.provider } : {}),
          ...(opts.byok ? { byok: opts.byok } : {}),
        });
        totalProcessed += triage.processed;
        lastHitRate = triage.cacheHitRate;
      }
    }

    opts.onTick?.({ processed: totalProcessed, cacheHitRate: lastHitRate, errors });
  } finally {
    inFlight = false;
  }
}

export function startSyncLoop(opts: SyncLoopOptions = {}): () => void {
  stopSyncLoop();
  const intervalMs = (opts.intervalSec ?? 60) * 1000;

  void runOnce(opts);
  currentTimer = setInterval(() => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => void runOnce(opts));
    } else {
      void runOnce(opts);
    }
  }, intervalMs);

  return stopSyncLoop;
}

export function stopSyncLoop(): void {
  if (currentTimer) {
    clearInterval(currentTimer);
    currentTimer = null;
  }
}
