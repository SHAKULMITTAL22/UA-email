import { NextResponse } from "next/server";
import { z } from "zod";
import { Bucket } from "@/lib/types/message";

const TriageRequest = z.object({
  provider: z.enum(["anthropic", "openai", "gemini"]).optional(),
  byok: z.string().optional(),
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

const TriageResult = z.object({
  messageId: z.string(),
  bucket: Bucket,
  summary: z.string().max(140),
  suggestedReply: z.string().max(500).nullable(),
});

export const TriageResponse = z.object({
  results: z.array(TriageResult),
  model: z.string(),
  promptCacheHit: z.boolean(),
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
    return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
  }

  // STUB: real LLM call lands with ai-agent. Phase-1 returns an empty
  // result set so the sync engine can run end-to-end against the stub.
  const stub: z.infer<typeof TriageResponse> = {
    results: parsed.data.emails.map((e) => ({
      messageId: e.messageId,
      bucket: "fyi" as const,
      summary: "(triage pending — AI not wired in this build)",
      suggestedReply: null,
    })),
    model: "stub",
    promptCacheHit: false,
  };

  return NextResponse.json(stub);
}
