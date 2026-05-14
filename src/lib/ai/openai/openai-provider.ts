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
        throw new LLMError(
          `OpenAI returned malformed JSON: ${parsed.error.message}`,
          "schema",
          true,
        );
      }

      const now = Date.now();
      return parsed.data.results.map((r) => ({
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
        status === 401
          ? "auth"
          : status === 429
            ? "rate_limit"
            : status && status >= 500
              ? "network"
              : "unknown";
      throw new LLMError(
        `OpenAI error: ${(err as Error).message}`,
        cause,
        cause === "rate_limit" || cause === "network",
      );
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
