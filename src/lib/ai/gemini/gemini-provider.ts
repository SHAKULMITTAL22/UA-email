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

const DEFAULT_MODEL = "gemini-3-flash-preview";

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
        throw new LLMError(
          `Gemini returned malformed JSON: ${parsed.error.message}`,
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
      const msg = (err as Error).message ?? "unknown";
      const cause: "rate_limit" | "auth" | "schema" | "network" | "unknown" =
        msg.toLowerCase().includes("api key")
          ? "auth"
          : msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate")
            ? "rate_limit"
            : "unknown";
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
