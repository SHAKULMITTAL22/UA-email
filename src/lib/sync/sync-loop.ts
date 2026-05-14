import { syncAccount } from "@/lib/sync/sync-engine";
import { triageNewMessages } from "@/lib/sync/triage-batcher";
import { listAccounts } from "@/lib/accounts/account-store";
import { getDB } from "@/lib/db/db";
import type { Message } from "@/lib/types/message";

const UNCLASSIFIED_PER_TICK = 200;

export interface SyncLoopOptions {
  intervalSec?: number;
  provider?: "anthropic" | "openai" | "gemini";
  byok?: string;
  onTick?: (info: {
    processed: number;
    cacheHitRate: number;
    errors: string[];
    aiError?: { message: string; cause: string };
  }) => void;
}

let currentTimer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

/** Pull up to N unclassified messages for an account so a stuck inbox self-heals
 *  when AI is misconfigured at first sync and corrected later. */
async function pullUnclassified(accountId: string, limit: number): Promise<Message[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = getDB();
  const rows = await db.messages
    .where("[accountId+receivedAt]")
    .between([accountId, 0], [accountId, Number.MAX_SAFE_INTEGER])
    .reverse()
    .filter((m) => !m.bucket)
    .limit(limit)
    .toArray();
  return rows as Message[];
}

export async function runOnce(opts: SyncLoopOptions = {}): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const accounts = await listAccounts();
    let totalProcessed = 0;
    let lastHitRate = 0;
    const errors: string[] = [];
    let aiError: { message: string; cause: string } | undefined;

    for (const account of accounts) {
      const result = await syncAccount(account);
      if (result.errored) {
        errors.push(`${account.email}: ${result.errorReason ?? "unknown"}`);
        continue;
      }
      const stuck = await pullUnclassified(account.id, UNCLASSIFIED_PER_TICK);
      const toTriage = [...result.newMessages, ...stuck];
      if (toTriage.length > 0) {
        const triage = await triageNewMessages(toTriage, {
          ...(opts.provider ? { provider: opts.provider } : {}),
          ...(opts.byok ? { byok: opts.byok } : {}),
        });
        totalProcessed += triage.processed;
        lastHitRate = triage.cacheHitRate;
        if (triage.lastErrorMessage && !aiError) {
          aiError = {
            message: triage.lastErrorMessage,
            cause: triage.lastErrorCause ?? "unknown",
          };
        }
      }
    }

    opts.onTick?.({
      processed: totalProcessed,
      cacheHitRate: lastHitRate,
      errors,
      ...(aiError ? { aiError } : {}),
    });
  } finally {
    inFlight = false;
  }
}

/**
 * Manual full-inbox re-triage. Pulls ALL unclassified per account (no per-tick cap)
 * and processes them in one pass. Used by the Settings "Re-triage everything" button.
 */
export async function retriageAll(opts: SyncLoopOptions = {}): Promise<{
  processed: number;
  totalUnclassified: number;
  aiError?: { message: string; cause: string };
}> {
  const accounts = await listAccounts();
  let processed = 0;
  let totalUnclassified = 0;
  let aiError: { message: string; cause: string } | undefined;

  for (const account of accounts) {
    const all = await pullUnclassified(account.id, 100_000);
    totalUnclassified += all.length;
    if (all.length === 0) continue;

    const triage = await triageNewMessages(all, {
      ...(opts.provider ? { provider: opts.provider } : {}),
      ...(opts.byok ? { byok: opts.byok } : {}),
    });
    processed += triage.processed;
    if (triage.lastErrorMessage && !aiError) {
      aiError = {
        message: triage.lastErrorMessage,
        cause: triage.lastErrorCause ?? "unknown",
      };
    }
  }

  return { processed, totalUnclassified, ...(aiError ? { aiError } : {}) };
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
