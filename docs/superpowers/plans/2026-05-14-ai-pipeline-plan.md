# UA-Email · AI Pipeline Plan (Phase 2 · Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`. Checkbox tracking.

**Goal:** Make the AI claim real. Replace the `/api/ai/triage` stub with three working LLM adapters (Anthropic default + OpenAI + Gemini), ship the shared prompts module with prompt caching wired for Anthropic, add `/api/ai/draft` for on-demand reply regeneration, and capture cache-hit metrics for the writeup.

**Tech additions:** `@anthropic-ai/sdk`, `openai`, `@google/generative-ai`, server-side response validation via existing `zod`.

---

## File Structure

```
src/lib/ai/
├── llm-provider.ts                         (EXISTS — interface)
├── prompts.ts                              ← Task 2
├── triage-schema.ts                        ← Task 2 (Zod schema for LLM JSON)
├── factory.ts                              ← Task 6
├── anthropic/anthropic-provider.ts          ← Task 3
├── openai/openai-provider.ts               ← Task 4
└── gemini/gemini-provider.ts               ← Task 5

src/app/api/ai/
├── triage/route.ts                          (EXTEND — Task 7)
└── draft/route.ts                           ← Task 8

tests/unit/
├── anthropic-provider.test.ts               ← Task 9
├── openai-provider.test.ts                  ← Task 9
└── gemini-provider.test.ts                  ← Task 9

src/lib/ai/metrics.ts                        ← Task 10 (in-memory hit-rate)
```

---

## Task 1: Install LLM SDKs

- [ ] **Step 1.1**

```bash
pnpm add @anthropic-ai/sdk openai @google/generative-ai
```

- [ ] **Step 1.2 — Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "[ai-agent] chore(deps): add Anthropic + OpenAI + Gemini SDKs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Shared prompts module + triage Zod schema

**Files:** Create `src/lib/ai/prompts.ts`, `src/lib/ai/triage-schema.ts`

- [ ] **Step 2.1 — Create `src/lib/ai/triage-schema.ts`**

```ts
import { z } from "zod";
import { Bucket } from "@/lib/types/message";

export const TriageItem = z.object({
  messageId: z.string(),
  bucket: Bucket,
  summary: z.string().max(140),
  suggestedReply: z.string().max(500).nullable(),
});

export const TriageList = z.object({
  results: z.array(TriageItem),
});

export type TriageItem = z.infer<typeof TriageItem>;
```

- [ ] **Step 2.2 — Create `src/lib/ai/prompts.ts`**

```ts
import type { TriageInput, ReplyContext } from "@/lib/ai/llm-provider";

export const TRIAGE_SYSTEM = `You triage email for a busy professional.

Classify every email into exactly one bucket:
- "needs_reply": personal correspondence requiring a response from the user
- "fyi": informational mail (status updates, notifications about user actions) — no reply needed
- "newsletter": promotional, marketing, digests, automated subscriptions
- "noise": low-signal automated mail (CI/build notifications, system noise, unverifiable senders)

For each email, write a single concise summary line (max 120 chars, present tense, factual — not "this email is about X"; instead "X happened" or "Y is asking for Z").

For "needs_reply" only, draft a suggested reply (max 300 chars). The reply should be warm-direct, sound like a busy adult, and address what was asked. For other buckets, suggestedReply = null.

Return ONLY a JSON object matching this schema, no prose:

{
  "results": [
    { "messageId": "<id>", "bucket": "needs_reply|fyi|newsletter|noise", "summary": "...", "suggestedReply": "..." or null }
  ]
}

Return results in the same order as the input. If a message looks suspicious or empty, classify as "noise" with summary "Empty or unparseable message".`;

export function triageUserPrompt(emails: TriageInput[]): string {
  const blocks = emails.map((e, i) =>
    `<email id="${e.messageId}" idx="${i}">
From: ${e.from}
Subject: ${e.subject}
Received: ${new Date(e.receivedAt).toISOString()}
Body:
${e.bodyExcerpt.slice(0, 2000)}
</email>`,
  ).join("\n\n");

  return `Here are ${emails.length} emails to triage:\n\n${blocks}\n\nReturn the JSON object now.`;
}

export const DRAFT_REPLY_SYSTEM = `You draft email replies on behalf of a busy professional.

Style:
- Warm-direct: friendly, but no fluff. No "I hope this finds you well" openers.
- Match the inbound message's register (formal → formal; casual → casual).
- ~120 words or less unless the thread genuinely demands more.
- Plain text, no Markdown.
- Sign off as the user signs off based on prior messages in the thread; if no signal, just first name or nothing.

Return ONLY the body of the reply (no subject line, no greeting/farewell unless natural).`;

export function draftReplyUserPrompt(threadPlaintext: string, tone?: ReplyContext["tone"]): string {
  const toneNote = tone ? `\n\nUse a "${tone}" tone.` : "";
  return `Below is the email thread you're replying to (newest message at the bottom). Draft a reply to the most recent message.${toneNote}\n\n<thread>\n${threadPlaintext}\n</thread>\n\nReturn the reply body now.`;
}
```

- [ ] **Step 2.3 — Commit**

```bash
git add src/lib/ai/prompts.ts src/lib/ai/triage-schema.ts
git commit -m "[ai-agent] feat(ai): shared prompts + Zod triage schema (provider-agnostic)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: AnthropicProvider with prompt caching

**Files:** Create `src/lib/ai/anthropic/anthropic-provider.ts`

- [ ] **Step 3.1**

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, TriageInput, ReplyContext } from "@/lib/ai/llm-provider";
import { LLMError } from "@/lib/ai/llm-provider";
import type { Message } from "@/lib/types/message";
import type { AiResult } from "@/lib/types/ai";
import { TriageList } from "@/lib/ai/triage-schema";
import {
  TRIAGE_SYSTEM,
  triageUserPrompt,
  DRAFT_REPLY_SYSTEM,
  draftReplyUserPrompt,
} from "@/lib/ai/prompts";
import { recordCacheUsage } from "@/lib/ai/metrics";

const DEFAULT_MODEL = "claude-opus-4-7";

export class AnthropicProvider implements LLMProvider {
  readonly id = "anthropic" as const;
  readonly model: string;
  private client: Anthropic;

  constructor(opts: { apiKey: string; model?: string }) {
    this.client = new Anthropic({ apiKey: opts.apiKey });
    this.model = opts.model ?? DEFAULT_MODEL;
  }

  async triageBatch(emails: TriageInput[]): Promise<AiResult[]> {
    if (emails.length === 0) return [];

    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: [
          {
            type: "text",
            text: TRIAGE_SYSTEM,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: triageUserPrompt(emails) }],
      });

      const cacheHit = (res.usage.cache_read_input_tokens ?? 0) > 0;
      recordCacheUsage(
        this.id,
        res.usage.cache_read_input_tokens ?? 0,
        res.usage.cache_creation_input_tokens ?? 0,
        res.usage.input_tokens ?? 0,
      );

      const text = res.content
        .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
        .map(b => b.text)
        .join("");

      const json = extractJson(text);
      const parsed = TriageList.safeParse(json);
      if (!parsed.success) {
        throw new LLMError(`Anthropic returned malformed JSON: ${parsed.error.message}`, "schema", true);
      }

      const now = Date.now();
      return parsed.data.results.map(r => ({
        messageId: r.messageId,
        bucket: r.bucket,
        summary: r.summary,
        suggestedReply: r.suggestedReply,
        model: this.model,
        processedAt: now,
        promptCacheHit: cacheHit,
        version: 1,
      }));
    } catch (err) {
      if (err instanceof LLMError) throw err;
      const status = (err as { status?: number }).status;
      const cause: "rate_limit" | "auth" | "schema" | "network" | "unknown" =
        status === 401 ? "auth" :
        status === 429 ? "rate_limit" :
        status && status >= 500 ? "network" : "unknown";
      throw new LLMError(`Anthropic error: ${(err as Error).message}`, cause, cause === "rate_limit" || cause === "network");
    }
  }

  async draftReply(_email: Message, ctx: ReplyContext): Promise<string> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 512,
      system: [
        { type: "text", text: DRAFT_REPLY_SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: draftReplyUserPrompt(ctx.threadPlaintext, ctx.tone) }],
    });

    return res.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map(b => b.text)
      .join("")
      .trim();
  }
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new LLMError("No JSON object found in response", "schema", true);
}
```

- [ ] **Step 3.2 — Commit**

```bash
git add src/lib/ai/anthropic
git commit -m "[ai-agent] feat(ai): AnthropicProvider with prompt caching + cache-hit metric

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: OpenAIProvider

**Files:** Create `src/lib/ai/openai/openai-provider.ts`

- [ ] **Step 4.1**

```ts
import OpenAI from "openai";
import type { LLMProvider, TriageInput, ReplyContext } from "@/lib/ai/llm-provider";
import { LLMError } from "@/lib/ai/llm-provider";
import type { Message } from "@/lib/types/message";
import type { AiResult } from "@/lib/types/ai";
import { TriageList } from "@/lib/ai/triage-schema";
import {
  TRIAGE_SYSTEM,
  triageUserPrompt,
  DRAFT_REPLY_SYSTEM,
  draftReplyUserPrompt,
} from "@/lib/ai/prompts";

const DEFAULT_MODEL = "gpt-4.1-mini";

export class OpenAIProvider implements LLMProvider {
  readonly id = "openai" as const;
  readonly model: string;
  private client: OpenAI;

  constructor(opts: { apiKey: string; model?: string }) {
    this.client = new OpenAI({ apiKey: opts.apiKey });
    this.model = opts.model ?? DEFAULT_MODEL;
  }

  async triageBatch(emails: TriageInput[]): Promise<AiResult[]> {
    if (emails.length === 0) return [];

    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: TRIAGE_SYSTEM },
          { role: "user", content: triageUserPrompt(emails) },
        ],
      });

      const text = res.choices[0]?.message?.content ?? "{}";
      const parsed = TriageList.safeParse(JSON.parse(text));
      if (!parsed.success) {
        throw new LLMError(`OpenAI returned malformed JSON: ${parsed.error.message}`, "schema", true);
      }

      const now = Date.now();
      return parsed.data.results.map(r => ({
        messageId: r.messageId,
        bucket: r.bucket,
        summary: r.summary,
        suggestedReply: r.suggestedReply,
        model: this.model,
        processedAt: now,
        promptCacheHit: false,
        version: 1,
      }));
    } catch (err) {
      if (err instanceof LLMError) throw err;
      const status = (err as { status?: number }).status;
      const cause: "rate_limit" | "auth" | "schema" | "network" | "unknown" =
        status === 401 ? "auth" :
        status === 429 ? "rate_limit" :
        status && status >= 500 ? "network" : "unknown";
      throw new LLMError(`OpenAI error: ${(err as Error).message}`, cause, cause === "rate_limit" || cause === "network");
    }
  }

  async draftReply(_email: Message, ctx: ReplyContext): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: DRAFT_REPLY_SYSTEM },
        { role: "user", content: draftReplyUserPrompt(ctx.threadPlaintext, ctx.tone) },
      ],
    });
    return res.choices[0]?.message?.content?.trim() ?? "";
  }
}
```

- [ ] **Step 4.2 — Commit**

```bash
git add src/lib/ai/openai
git commit -m "[ai-agent] feat(ai): OpenAIProvider with JSON mode

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: GeminiProvider

**Files:** Create `src/lib/ai/gemini/gemini-provider.ts`

- [ ] **Step 5.1**

```ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMProvider, TriageInput, ReplyContext } from "@/lib/ai/llm-provider";
import { LLMError } from "@/lib/ai/llm-provider";
import type { Message } from "@/lib/types/message";
import type { AiResult } from "@/lib/types/ai";
import { TriageList } from "@/lib/ai/triage-schema";
import {
  TRIAGE_SYSTEM,
  triageUserPrompt,
  DRAFT_REPLY_SYSTEM,
  draftReplyUserPrompt,
} from "@/lib/ai/prompts";

const DEFAULT_MODEL = "gemini-2.5-flash";

export class GeminiProvider implements LLMProvider {
  readonly id = "gemini" as const;
  readonly model: string;
  private client: GoogleGenerativeAI;

  constructor(opts: { apiKey: string; model?: string }) {
    this.client = new GoogleGenerativeAI(opts.apiKey);
    this.model = opts.model ?? DEFAULT_MODEL;
  }

  async triageBatch(emails: TriageInput[]): Promise<AiResult[]> {
    if (emails.length === 0) return [];

    try {
      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: TRIAGE_SYSTEM,
        generationConfig: { responseMimeType: "application/json" },
      });
      const res = await model.generateContent(triageUserPrompt(emails));
      const text = res.response.text();
      const parsed = TriageList.safeParse(JSON.parse(text));
      if (!parsed.success) {
        throw new LLMError(`Gemini returned malformed JSON: ${parsed.error.message}`, "schema", true);
      }

      const now = Date.now();
      return parsed.data.results.map(r => ({
        messageId: r.messageId,
        bucket: r.bucket,
        summary: r.summary,
        suggestedReply: r.suggestedReply,
        model: this.model,
        processedAt: now,
        promptCacheHit: false,
        version: 1,
      }));
    } catch (err) {
      if (err instanceof LLMError) throw err;
      const msg = (err as Error).message ?? "unknown";
      const cause: "rate_limit" | "auth" | "schema" | "network" | "unknown" =
        msg.toLowerCase().includes("api key") ? "auth" :
        msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate") ? "rate_limit" :
        "unknown";
      throw new LLMError(`Gemini error: ${msg}`, cause, cause === "rate_limit");
    }
  }

  async draftReply(_email: Message, ctx: ReplyContext): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: DRAFT_REPLY_SYSTEM,
    });
    const res = await model.generateContent(draftReplyUserPrompt(ctx.threadPlaintext, ctx.tone));
    return res.response.text().trim();
  }
}
```

- [ ] **Step 5.2 — Commit**

```bash
git add src/lib/ai/gemini
git commit -m "[ai-agent] feat(ai): GeminiProvider via @google/generative-ai

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: LLM factory + in-memory metrics

**Files:** Create `src/lib/ai/factory.ts`, `src/lib/ai/metrics.ts`

- [ ] **Step 6.1 — Create `src/lib/ai/metrics.ts`**

```ts
interface CacheBucket {
  hits: number;
  creations: number;
  inputTokens: number;
  totalCalls: number;
}

const stats: Record<string, CacheBucket> = {};

export function recordCacheUsage(
  providerId: string,
  readCached: number,
  createdCache: number,
  inputTokens: number,
): void {
  const b = stats[providerId] ?? { hits: 0, creations: 0, inputTokens: 0, totalCalls: 0 };
  b.totalCalls += 1;
  if (readCached > 0) b.hits += 1;
  if (createdCache > 0) b.creations += 1;
  b.inputTokens += inputTokens;
  stats[providerId] = b;
}

export function snapshotMetrics(): Record<string, CacheBucket & { hitRate: number }> {
  const out: Record<string, CacheBucket & { hitRate: number }> = {};
  for (const [k, v] of Object.entries(stats)) {
    out[k] = { ...v, hitRate: v.totalCalls === 0 ? 0 : v.hits / v.totalCalls };
  }
  return out;
}
```

- [ ] **Step 6.2 — Create `src/lib/ai/factory.ts`**

```ts
import type { LLMProvider } from "@/lib/ai/llm-provider";
import { LLMError } from "@/lib/ai/llm-provider";
import { AnthropicProvider } from "@/lib/ai/anthropic/anthropic-provider";
import { OpenAIProvider } from "@/lib/ai/openai/openai-provider";
import { GeminiProvider } from "@/lib/ai/gemini/gemini-provider";
import { env } from "@/lib/env";

export interface LLMSelection {
  provider: "anthropic" | "openai" | "gemini";
  apiKey?: string;
  model?: string;
}

export function makeLLM(sel?: Partial<LLMSelection>): LLMProvider {
  const provider = sel?.provider ?? env.DEFAULT_LLM_PROVIDER;
  const byok = sel?.apiKey;

  switch (provider) {
    case "anthropic": {
      const key = byok ?? env.ANTHROPIC_API_KEY;
      if (!key) throw new LLMError("Anthropic API key not configured", "auth", false);
      return new AnthropicProvider({ apiKey: key, ...(sel?.model ? { model: sel.model } : {}) });
    }
    case "openai": {
      const key = byok ?? env.OPENAI_API_KEY;
      if (!key) throw new LLMError("OpenAI API key not configured", "auth", false);
      return new OpenAIProvider({ apiKey: key, ...(sel?.model ? { model: sel.model } : {}) });
    }
    case "gemini": {
      const key = byok ?? env.GOOGLE_AI_API_KEY;
      if (!key) throw new LLMError("Google AI API key not configured", "auth", false);
      return new GeminiProvider({ apiKey: key, ...(sel?.model ? { model: sel.model } : {}) });
    }
  }
}
```

- [ ] **Step 6.3 — Commit**

```bash
git add src/lib/ai/factory.ts src/lib/ai/metrics.ts
git commit -m "[ai-agent] feat(ai): LLM factory + in-memory cache-hit metrics

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire `/api/ai/triage` to real LLM

**Files:** Replace `src/app/api/ai/triage/route.ts`

- [ ] **Step 7.1**

```ts
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
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const parsed = TriageRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
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
        err.cause === "auth" ? 401 :
        err.cause === "rate_limit" ? 429 :
        err.cause === "schema" ? 502 :
        err.cause === "network" ? 502 : 500;
      return NextResponse.json(
        { error: err.cause, message: err.message, retryable: err.retryable },
        { status },
      );
    }
    return NextResponse.json({ error: "unknown", message: (err as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 7.2 — Commit**

```bash
git add src/app/api/ai/triage/route.ts
git commit -m "[ai-agent] feat(ai): /api/ai/triage now routes through real LLM factory

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `/api/ai/draft` route

**Files:** Create `src/app/api/ai/draft/route.ts`

- [ ] **Step 8.1**

```ts
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
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const parsed = DraftRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
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
      return NextResponse.json({ error: err.cause, message: err.message, retryable: err.retryable }, { status });
    }
    return NextResponse.json({ error: "unknown", message: (err as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 8.2 — Commit**

```bash
git add src/app/api/ai/draft
git commit -m "[ai-agent] feat(ai): /api/ai/draft route for on-demand reply regeneration

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Unit tests for all three LLM providers

**Files:** Create `tests/unit/llm-providers.test.ts`

- [ ] **Step 9.1**

We test the **mapping + error classification** layer, not the wire calls (those are SDK-internal). Strategy: mock the underlying SDK modules with `vi.mock`.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the SDKs *before* importing the providers (vi.mock is hoisted).
vi.mock("@anthropic-ai/sdk", () => {
  const create = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create },
    })),
    __mockCreate: create,
  };
});
vi.mock("openai", () => {
  const create = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: { completions: { create } },
    })),
    __mockCreate: create,
  };
});
vi.mock("@google/generative-ai", () => {
  const generateContent = vi.fn();
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: () => ({ generateContent }),
    })),
    __mockGenerate: generateContent,
  };
});

import { AnthropicProvider } from "@/lib/ai/anthropic/anthropic-provider";
import { OpenAIProvider } from "@/lib/ai/openai/openai-provider";
import { GeminiProvider } from "@/lib/ai/gemini/gemini-provider";
import { LLMError } from "@/lib/ai/llm-provider";

const INPUTS = [{
  messageId: "m1",
  from: "alice@example.com",
  subject: "hello",
  bodyExcerpt: "test",
  receivedAt: 1_700_000_000_000,
}];

const GOOD_JSON = '{"results":[{"messageId":"m1","bucket":"needs_reply","summary":"Alice says hi.","suggestedReply":"Hi back."}]}';

describe("AnthropicProvider", () => {
  let mockCreate: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    const mod = await import("@anthropic-ai/sdk") as { __mockCreate: ReturnType<typeof vi.fn> };
    mockCreate = mod.__mockCreate;
    mockCreate.mockReset();
  });

  it("triageBatch parses JSON + reports cache hit", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: GOOD_JSON }],
      usage: { cache_read_input_tokens: 100, cache_creation_input_tokens: 0, input_tokens: 100 },
    });
    const provider = new AnthropicProvider({ apiKey: "test" });
    const out = await provider.triageBatch(INPUTS);
    expect(out).toHaveLength(1);
    expect(out[0]?.bucket).toBe("needs_reply");
    expect(out[0]?.promptCacheHit).toBe(true);
  });

  it("triageBatch throws LLMError schema on malformed JSON", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "not json at all" }],
      usage: { cache_read_input_tokens: 0, cache_creation_input_tokens: 0, input_tokens: 0 },
    });
    const provider = new AnthropicProvider({ apiKey: "test" });
    await expect(provider.triageBatch(INPUTS)).rejects.toBeInstanceOf(LLMError);
  });

  it("triageBatch maps 429 to LLMError rate_limit retryable", async () => {
    mockCreate.mockRejectedValue(Object.assign(new Error("Too Many"), { status: 429 }));
    const provider = new AnthropicProvider({ apiKey: "test" });
    await expect(provider.triageBatch(INPUTS)).rejects.toMatchObject({ cause: "rate_limit", retryable: true });
  });
});

describe("OpenAIProvider", () => {
  let mockCreate: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    const mod = await import("openai") as { __mockCreate: ReturnType<typeof vi.fn> };
    mockCreate = mod.__mockCreate;
    mockCreate.mockReset();
  });

  it("triageBatch parses JSON-mode response", async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: GOOD_JSON } }] });
    const provider = new OpenAIProvider({ apiKey: "test" });
    const out = await provider.triageBatch(INPUTS);
    expect(out[0]?.bucket).toBe("needs_reply");
    expect(out[0]?.promptCacheHit).toBe(false);
  });

  it("triageBatch maps 401 to auth", async () => {
    mockCreate.mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }));
    const provider = new OpenAIProvider({ apiKey: "bad" });
    await expect(provider.triageBatch(INPUTS)).rejects.toMatchObject({ cause: "auth" });
  });
});

describe("GeminiProvider", () => {
  let mockGenerate: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    const mod = await import("@google/generative-ai") as { __mockGenerate: ReturnType<typeof vi.fn> };
    mockGenerate = mod.__mockGenerate;
    mockGenerate.mockReset();
  });

  it("triageBatch parses JSON-mime response", async () => {
    mockGenerate.mockResolvedValue({ response: { text: () => GOOD_JSON } });
    const provider = new GeminiProvider({ apiKey: "test" });
    const out = await provider.triageBatch(INPUTS);
    expect(out[0]?.summary).toContain("Alice");
  });

  it("triageBatch maps 'API key' error to auth", async () => {
    mockGenerate.mockRejectedValue(new Error("Invalid API key"));
    const provider = new GeminiProvider({ apiKey: "bad" });
    await expect(provider.triageBatch(INPUTS)).rejects.toMatchObject({ cause: "auth" });
  });
});
```

- [ ] **Step 9.2 — Commit**

```bash
git add tests/unit/llm-providers.test.ts
git commit -m "[test-agent] test(ai): LLMProvider mapping + error classification (3 vendors)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Verify full local gauntlet + commit

- [ ] **Step 10.1**

```bash
pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build && pnpm test:e2e --project=chromium
```

All must exit 0. Unit tests should be at **9 (Phase 1+2.A) + 7 (this plan) = 16**.

- [ ] **Step 10.2 — If anything broke, fix it under prefix `[infra-agent]` and commit before continuing**

---

## Self-Review

- Spec §6 (LLMProvider interface + Anthropic prompt-caching) — ✓ Tasks 3-6, metrics module.
- Spec §10 (LLM failure modes — schema, rate-limit, network, auth) — ✓ Task 7 maps cause to HTTP status.
- Spec §16 (cache-hit metric in writeup) — ✓ Task 6 metrics + Task 7 surfaces `cacheHitRate` in response.
- No placeholders.

## Execution Handoff

Plan complete. Save to `docs/superpowers/plans/2026-05-14-ai-pipeline-plan.md`. Subagent-driven execution.
