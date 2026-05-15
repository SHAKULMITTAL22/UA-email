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
        .map((b) => b.text)
        .join("");

      const json = extractJson(text);
      const parsed = TriageList.safeParse(json);
      if (!parsed.success) {
        throw new LLMError(
          `Anthropic returned malformed JSON: ${parsed.error.message}`,
          "schema",
          true,
        );
      }

      const now = Date.now();
      return parsed.data.results.map((r) => ({
        messageId: r.messageId,
        bucket: r.bucket,
        summary: r.summary,
        ...(r.detailedSummary ? { detailedSummary: r.detailedSummary } : {}),
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
        status === 401
          ? "auth"
          : status === 429
            ? "rate_limit"
            : status && status >= 500
              ? "network"
              : "unknown";
      throw new LLMError(
        `Anthropic error: ${(err as Error).message}`,
        cause,
        cause === "rate_limit" || cause === "network",
      );
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
      .map((b) => b.text)
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
