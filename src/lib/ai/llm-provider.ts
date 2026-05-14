import type { Message } from "@/lib/types/message";
import type { AiResult } from "@/lib/types/ai";

export interface TriageInput {
  messageId: string;
  from: string;            // "Name <email>"
  subject: string;
  bodyExcerpt: string;     // first ~2000 chars of plain-text body
  receivedAt: number;
}

export interface ReplyContext {
  /** The thread up to (and including) the message being replied to. */
  threadPlaintext: string;
  /** Optional tone hint from the user. */
  tone?: "concise" | "warm" | "formal";
}

/**
 * Pluggable AI backend. Three implementations:
 *   - src/lib/ai/anthropic/anthropic-provider.ts  (default, prompt caching)
 *   - src/lib/ai/openai/openai-provider.ts
 *   - src/lib/ai/gemini/gemini-provider.ts
 *
 * All adapters share prompts from src/lib/ai/prompts.ts.
 * Responses are validated with Zod (AiResult) before returning.
 */
export interface LLMProvider {
  readonly id: "anthropic" | "openai" | "gemini";
  readonly model: string;

  /**
   * Classify a batch of up to N=20 messages in one structured-output call.
   * @returns one AiResult per input, in the same order, with `promptCacheHit`
   *          populated when the underlying provider exposes it.
   */
  triageBatch(emails: TriageInput[]): Promise<AiResult[]>;

  /**
   * On-demand: regenerate / refine a reply for a single message.
   * Used when the user clicks "Suggest a reply" or "Regenerate" in thread view.
   */
  draftReply(email: Message, ctx: ReplyContext): Promise<string>;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly cause: "rate_limit" | "auth" | "schema" | "network" | "unknown",
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "LLMError";
  }
}
