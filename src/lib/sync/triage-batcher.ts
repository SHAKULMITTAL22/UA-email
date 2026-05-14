import { getDB } from "@/lib/db/db";
import type { Message } from "@/lib/types/message";
import type { AiResult } from "@/lib/types/ai";

const BATCH_SIZE = 20;

export interface TriageBatchOptions {
  provider?: "anthropic" | "openai" | "gemini";
  byok?: string;
}

export interface TriageBatchResult {
  processed: number;
  cacheHitRate: number;
  lastErrorMessage?: string;
  lastErrorCause?: "auth" | "rate_limit" | "schema" | "network" | "validation_failed" | "unknown";
}

export async function triageNewMessages(
  newMessages: Message[],
  opts: TriageBatchOptions = {},
): Promise<TriageBatchResult> {
  if (newMessages.length === 0) return { processed: 0, cacheHitRate: 0 };

  const db = getDB();
  const batches: Message[][] = [];
  for (let i = 0; i < newMessages.length; i += BATCH_SIZE) {
    batches.push(newMessages.slice(i, i + BATCH_SIZE));
  }

  let processed = 0;
  let lastHitRate = 0;
  let lastErrorMessage: string | undefined;
  let lastErrorCause: TriageBatchResult["lastErrorCause"];

  for (const batch of batches) {
    const payload = {
      ...(opts.provider ? { provider: opts.provider } : {}),
      ...(opts.byok ? { byok: opts.byok } : {}),
      emails: batch.map((m) => ({
        messageId: m.id,
        from: m.from.name ? `${m.from.name} <${m.from.email}>` : m.from.email,
        subject: m.subject,
        bodyExcerpt: m.body.slice(0, 4000),
        receivedAt: m.receivedAt,
      })),
    };

    const res = await fetch("/api/ai/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      lastErrorMessage = body.message ?? body.error ?? `HTTP ${res.status}`;
      lastErrorCause = (body.error as TriageBatchResult["lastErrorCause"]) ?? "unknown";
      console.warn("[triage-batcher] AI call failed", body);
      break;
    }

    const data = (await res.json()) as {
      results: AiResult[];
      model: string;
      promptCacheHit: boolean;
      cacheHitRate: number;
    };
    lastHitRate = data.cacheHitRate ?? 0;

    if (data.results.length > 0) {
      await db.transaction("rw", [db.aiResults, db.messages], async () => {
        await db.aiResults.bulkPut(data.results);
        for (const r of data.results) {
          await db.messages.update(r.messageId, {
            bucket: r.bucket,
            aiProcessedAt: r.processedAt,
            promptCacheHit: r.promptCacheHit,
          });
        }
      });
    }

    processed += data.results.length;
  }

  return {
    processed,
    cacheHitRate: lastHitRate,
    ...(lastErrorMessage ? { lastErrorMessage } : {}),
    ...(lastErrorCause ? { lastErrorCause } : {}),
  };
}
