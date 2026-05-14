import type { Account, OAuthTokens } from "@/lib/types/account";
import type { Message } from "@/lib/types/message";
import {
  type MailProvider,
  type Draft,
  type ListResult,
  ProviderError,
} from "@/lib/providers/mail-provider";

const BASE = "https://graph.microsoft.com/v1.0/me";

export class OutlookProvider implements MailProvider {
  readonly id = "outlook" as const;
  constructor(public readonly account: Account) {
    if (!account.oauthTokens) throw new ProviderError("Outlook missing tokens", "auth", false);
  }
  private get tokens(): OAuthTokens {
    if (!this.account.oauthTokens) throw new ProviderError("missing tokens", "auth", false);
    return this.account.oauthTokens;
  }

  async list(opts: { cursor?: string; limit?: number }): Promise<ListResult> {
    const q = new URLSearchParams({
      $top: String(opts.limit ?? 50),
      $orderby: "receivedDateTime desc",
    });
    if (opts.cursor) q.set("$skiptoken", opts.cursor);
    const data = await this.gFetch<{ value: GraphMessage[]; "@odata.nextLink"?: string }>(
      `/mailFolders/inbox/messages?${q.toString()}`,
    );
    const nextLink = data["@odata.nextLink"];
    return {
      messages: data.value.map((m) => this.toMessage(m)),
      ...(nextLink ? { nextCursor: nextLink } : {}),
    };
  }

  async get(messageId: string): Promise<Message> {
    const gid = messageId.split(":").pop()!;
    const raw = await this.gFetch<GraphMessage>(`/messages/${gid}`);
    return this.toMessage(raw);
  }

  async send(draft: Draft): Promise<{ messageId: string }> {
    await this.gFetch("/sendMail", {
      method: "POST",
      body: JSON.stringify({
        message: {
          subject: draft.subject,
          body: { contentType: "Text", content: draft.body },
          toRecipients: draft.to.map((a) => ({
            emailAddress: { address: a.email, ...(a.name ? { name: a.name } : {}) },
          })),
        },
        saveToSentItems: true,
      }),
    });
    return { messageId: `${this.account.id}:local-${Date.now()}` };
  }

  async archive(messageId: string): Promise<void> {
    const gid = messageId.split(":").pop()!;
    await this.gFetch(`/messages/${gid}/move`, {
      method: "POST",
      body: JSON.stringify({ destinationId: "archive" }),
    });
  }

  async delete(messageId: string): Promise<void> {
    const gid = messageId.split(":").pop()!;
    await this.gFetch(`/messages/${gid}`, { method: "DELETE" });
  }

  async setLabel(messageId: string, label: string, on: boolean): Promise<void> {
    const gid = messageId.split(":").pop()!;
    await this.gFetch(`/messages/${gid}`, {
      method: "PATCH",
      body: JSON.stringify({ categories: on ? [label] : [] }),
    });
  }

  async search(query: string): Promise<Message[]> {
    const q = new URLSearchParams({ $search: `"${query}"`, $top: "50" });
    const data = await this.gFetch<{ value: GraphMessage[] }>(`/messages?${q.toString()}`);
    return data.value.map((m) => this.toMessage(m));
  }

  private toMessage(raw: GraphMessage): Message {
    const fromName = raw.from?.emailAddress?.name;
    const fromEmail = raw.from?.emailAddress?.address ?? "unknown@unknown";
    return {
      id: `${this.account.id}:${raw.id}`,
      accountId: this.account.id,
      threadId: `${this.account.id}:${raw.conversationId}`,
      from: { ...(fromName ? { name: fromName } : {}), email: fromEmail },
      to: (raw.toRecipients ?? []).map((r) => ({
        ...(r.emailAddress.name ? { name: r.emailAddress.name } : {}),
        email: r.emailAddress.address,
      })),
      cc: (raw.ccRecipients ?? []).map((r) => ({ email: r.emailAddress.address })),
      bcc: [],
      subject: raw.subject ?? "(no subject)",
      snippet: raw.bodyPreview ?? "",
      body: raw.body?.contentType === "Text" ? raw.body.content : stripHtml(raw.body?.content ?? ""),
      ...(raw.body?.contentType === "HTML" ? { bodyHtml: raw.body.content } : {}),
      receivedAt: new Date(raw.receivedDateTime).getTime(),
      labels: raw.categories ?? [],
      flags: {
        unread: !raw.isRead,
        starred: raw.flag?.flagStatus === "flagged",
        archived: false,
        trashed: false,
      },
    };
  }

  private async gFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${this.tokens.accessToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const cause: "auth" | "rate_limit" | "network" | "unknown" =
        res.status === 401
          ? "auth"
          : res.status === 429
            ? "rate_limit"
            : res.status >= 500
              ? "network"
              : "unknown";
      throw new ProviderError(
        `Graph ${path} failed (${res.status})`,
        cause,
        res.status >= 500 || res.status === 429,
      );
    }
    if (res.status === 204) return undefined as unknown as T;
    return res.json();
  }
}

interface GraphAddress {
  emailAddress: { address: string; name?: string };
}
interface GraphMessage {
  id: string;
  conversationId: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType: "Text" | "HTML"; content: string };
  from?: GraphAddress;
  toRecipients?: GraphAddress[];
  ccRecipients?: GraphAddress[];
  receivedDateTime: string;
  isRead: boolean;
  categories?: string[];
  flag?: { flagStatus: "notFlagged" | "flagged" | "complete" };
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}
