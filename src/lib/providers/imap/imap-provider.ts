import type { Account, ImapCreds } from "@/lib/types/account";
import type { Message } from "@/lib/types/message";
import {
  type MailProvider,
  type Draft,
  type ListResult,
  ProviderError,
} from "@/lib/providers/mail-provider";

export class ImapProvider implements MailProvider {
  readonly id = "imap" as const;

  constructor(public readonly account: Account) {
    if (!account.imapCreds) {
      throw new ProviderError("IMAP account missing creds", "auth", false);
    }
  }

  private get creds(): ImapCreds {
    if (!this.account.imapCreds) throw new ProviderError("missing creds", "auth", false);
    return this.account.imapCreds;
  }

  async list(opts: { cursor?: string; limit?: number }): Promise<ListResult> {
    const res = await this.call("list", {
      accountId: this.account.id,
      creds: this.creds,
      ...(opts.cursor ? { sinceUid: Number(opts.cursor) } : {}),
      ...(opts.limit ? { limit: opts.limit } : {}),
    });
    const messages: Message[] = (res.messages ?? []).map((m: ImapServerMessage) => this.toMessage(m));
    return { messages, ...(res.nextCursor ? { nextCursor: res.nextCursor } : {}) };
  }

  async get(messageId: string): Promise<Message> {
    const uid = this.uidFromMessageId(messageId);
    const res = await this.call("get", {
      accountId: this.account.id,
      creds: this.creds,
      uid,
    });
    return this.toMessage(res as unknown as ImapServerMessage);
  }

  async send(draft: Draft): Promise<{ messageId: string }> {
    const rfc822 = buildRfc822(this.account.email, draft);
    const res = await this.call("send", {
      accountId: this.account.id,
      creds: this.creds,
      rfc822,
    });
    return { messageId: (res.messageId as string | undefined) ?? `local-${Date.now()}` };
  }

  async archive(messageId: string): Promise<void> {
    await this.flag(messageId, "\\Deleted", true);
  }

  async delete(messageId: string): Promise<void> {
    await this.flag(messageId, "\\Deleted", true);
  }

  async setLabel(messageId: string, label: string, on: boolean): Promise<void> {
    await this.flag(messageId, label, on);
  }

  async search(query: string): Promise<Message[]> {
    const result = await this.list({ limit: 200 });
    const q = query.toLowerCase();
    return result.messages.filter((m) =>
      m.subject.toLowerCase().includes(q) ||
      m.snippet.toLowerCase().includes(q) ||
      m.from.email.toLowerCase().includes(q),
    );
  }

  private async flag(messageId: string, flag: string, on: boolean): Promise<void> {
    const uid = this.uidFromMessageId(messageId);
    await this.call("flag", {
      accountId: this.account.id,
      creds: this.creds,
      uid,
      flag,
      on,
    });
  }

  private uidFromMessageId(id: string): number {
    const parts = id.split(":");
    const last = parts[parts.length - 1];
    if (!last) throw new ProviderError(`bad messageId: ${id}`, "validation", false);
    const n = Number(last);
    if (Number.isNaN(n)) throw new ProviderError(`bad uid in messageId: ${id}`, "validation", false);
    return n;
  }

  private toMessage(m: ImapServerMessage): Message {
    return {
      id: `${this.account.id}:${m.uid}`,
      accountId: this.account.id,
      threadId: `${this.account.id}:${m.threadId}`,
      from: m.from,
      to: m.to,
      cc: m.cc,
      bcc: [],
      subject: m.subject,
      snippet: m.snippet,
      body: m.body,
      ...(m.bodyHtml ? { bodyHtml: m.bodyHtml } : {}),
      receivedAt: m.receivedAt,
      labels: m.labels,
      flags: {
        unread: m.flags.unread,
        starred: m.flags.flagged,
        archived: false,
        trashed: false,
      },
    };
  }

  private async call(op: string, payload: object): Promise<ImapServerMessage & Record<string, unknown> & { messages?: ImapServerMessage[]; nextCursor?: string }> {
    const res = await fetch("/api/imap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op, ...payload }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const cause: "rate_limit" | "auth" | "network" | "validation" | "unknown" =
        res.status === 401 ? "auth" :
        res.status === 502 ? "network" :
        res.status === 400 ? "validation" :
        res.status === 429 ? "rate_limit" : "unknown";
      throw new ProviderError(body.message ?? `IMAP ${op} failed`, cause, body.retryable ?? false);
    }
    return res.json();
  }
}

interface ImapServerMessage {
  uid: number;
  messageId: string;
  threadId: string;
  from: { email: string; name?: string };
  to: { email: string; name?: string }[];
  cc: { email: string; name?: string }[];
  subject: string;
  snippet: string;
  body: string;
  bodyHtml?: string;
  receivedAt: number;
  flags: { unread: boolean; flagged: boolean };
  labels: string[];
}

function buildRfc822(from: string, draft: Draft): string {
  const to = draft.to.map(a => a.name ? `"${a.name}" <${a.email}>` : a.email).join(", ");
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${draft.subject}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    draft.inReplyToMessageId ? `In-Reply-To: ${draft.inReplyToMessageId}` : "",
  ].filter(Boolean).join("\r\n");
  return `${headers}\r\n\r\n${draft.body}`;
}
