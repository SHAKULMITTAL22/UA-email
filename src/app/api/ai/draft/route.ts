import { NextResponse } from "next/server";
import { z } from "zod";
import { makeLLM } from "@/lib/ai/factory";
import { LLMError } from "@/lib/ai/llm-provider";

export const runtime = "nodejs";
export const maxDuration = 30;

const DraftRequest = z.object({
  provider: z.enum(["anthropic", "openai", "gemini"]).optional(),
  byok: z.string().optional(),
  email: z.object({
    id: z.string(),
    threadId: z.string(),
    subject: z.string(),
    body: z.string(),
  }),
  threadPlaintext: z.string(),
  tone: z.enum(["concise", "warm", "formal"]).optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = DraftRequest.safeParse(body);
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
    });

    // We only feed the structural fields the prompts module expects.
    const fakeEmail = {
      id: parsed.data.email.id,
      accountId: "",
      threadId: parsed.data.email.threadId,
      from: { email: "" },
      to: [],
      cc: [],
      bcc: [],
      subject: parsed.data.email.subject,
      snippet: "",
      body: parsed.data.email.body,
      receivedAt: 0,
      labels: [],
      flags: { unread: false, starred: false, archived: false, trashed: false },
    };

    const draft = await llm.draftReply(fakeEmail, {
      threadPlaintext: parsed.data.threadPlaintext,
      ...(parsed.data.tone ? { tone: parsed.data.tone } : {}),
    });
    return NextResponse.json({ draft, model: llm.model });
  } catch (err) {
    if (err instanceof LLMError) {
      const status = err.cause === "auth" ? 401 : err.cause === "rate_limit" ? 429 : 502;
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
