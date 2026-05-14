import type { Message } from "@/lib/types/message";
import type { Account } from "@/lib/types/account";

export interface Draft {
  to: { email: string; name?: string }[];
  cc?: { email: string; name?: string }[];
  bcc?: { email: string; name?: string }[];
  subject: string;
  body: string;
  inReplyToMessageId?: string;
}

export interface ListResult {
  messages: Message[];
  nextCursor?: string;
}

/**
 * Contract every email backend implements. The unified inbox concatenates
 * across all configured accounts using only this interface.
 *
 * Provider implementations live in `src/lib/providers/<id>/`:
 *   - gmail/gmail-provider.ts
 *   - outlook/outlook-provider.ts
 *   - imap/imap-provider.ts
 */
export interface MailProvider {
  readonly id: "gmail" | "outlook" | "imap";
  readonly account: Account;

  list(opts: { cursor?: string; since?: Date; limit?: number }): Promise<ListResult>;
  get(messageId: string): Promise<Message>;
  send(draft: Draft): Promise<{ messageId: string }>;
  archive(messageId: string): Promise<void>;
  delete(messageId: string): Promise<void>;
  setLabel(messageId: string, label: string, on: boolean): Promise<void>;
  search(query: string): Promise<Message[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly cause: "rate_limit" | "auth" | "network" | "validation" | "unknown",
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
