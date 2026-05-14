import { NextResponse } from "next/server";
import { z } from "zod";
import { makeLLM } from "@/lib/ai/factory";
import { LLMError } from "@/lib/ai/llm-provider";
import { snapshotMetrics } from "@/lib/ai/metrics";

export const runtime = "nodejs";
export const maxDuration = 60;

export const TriageRequest = z.object({
  provider: z.enum(["anthropic", "openai", "gemini"]).optional(),
  byok: z.string().optional(),
  model: z.string().optional(),
  emails: z
    .array(
      z.object({
        messageId: z.string(),
        from: z.string(),
        subject: z.string(),
        bodyExcerpt: z.string().max(8000),
        receivedAt: z.number().int(),
      }),
    )
    .min(1)
    .max(20),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = TriageRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const llm = makeLLM({
      ...(parsed.data.provider ? { provider: parsed.data.provider } : {}),
      ...(parsed.data.byok ? { apiKey: parsed.data.byok } : {}),
      ...(parsed.data.model ? { model: parsed.data.model } : {}),
    });

    const results = await llm.triageBatch(parsed.data.emails);
    const metrics = snapshotMetrics()[llm.id];
    return NextResponse.json({
      results,
      model: llm.model,
      promptCacheHit: results.length > 0 && results[0]!.promptCacheHit,
      cacheHitRate: metrics?.hitRate ?? 0,
    });
  } catch (err) {
    if (err instanceof LLMError) {
      const status =
        err.cause === "auth"
          ? 401
          : err.cause === "rate_limit"
            ? 429
            : err.cause === "schema"
              ? 502
              : err.cause === "network"
                ? 502
                : 500;
      return NextResponse.json(
        { error: err.cause, message: err.message, retryable: err.retryable },
        { status },
      );
    }
    return NextResponse.json(
      { error: "unknown", message: (err as Error).message },
      { status: 500 },
    );
  }
}
