import type { Account, OAuthTokens } from "@/lib/types/account";
import type { Message } from "@/lib/types/message";
import {
  type MailProvider,
  type Draft,
  type ListResult,
  ProviderError,
} from "@/lib/providers/mail-provider";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailProvider implements MailProvider {
  readonly id = "gmail" as const;
  constructor(public readonly account: Account) {
    if (!account.oauthTokens) throw new ProviderError("Gmail account missing tokens", "auth", false);
  }

  private get tokens(): OAuthTokens {
    if (!this.account.oauthTokens) throw new ProviderError("missing tokens", "auth", false);
    return this.account.oauthTokens;
  }

  async list(opts: { cursor?: string; limit?: number }): Promise<ListResult> {
    const q = new URLSearchParams({
      maxResults: String(opts.limit ?? 50),
      labelIds: "INBOX",
    });
    if (opts.cursor) q.set("pageToken", opts.cursor);
    const list = await this.gFetch<{ messages?: { id: string }[]; nextPageToken?: string }>(
      `/messages?${q.toString()}`,
    );
    const ids = list.messages?.map((m) => m.id) ?? [];
    const messages = await Promise.all(ids.map((id) => this.get(`${this.account.id}:${id}`)));
    return {
      messages,
      ...(list.nextPageToken ? { nextCursor: list.nextPageToken } : {}),
    };
  }

  async get(messageId: string): Promise<Message> {
    const gid = messageId.split(":").pop()!;
    const raw = await this.gFetch<GmailMessageResource>(`/messages/${gid}?format=full`);
    return this.toMessage(raw);
  }

  async send(draft: Draft): Promise<{ messageId: string }> {
    const rfc = buildRfc822(this.account.email, draft);
    const encoded = encodeBase64Url(rfc);
    const res = await this.gFetch<{ id: string }>("/messages/send", {
      method: "POST",
      body: JSON.stringify({ raw: encoded }),
    });
    return { messageId: `${this.account.id}:${res.id}` };
  }

  async archive(messageId: string): Promise<void> {
    const gid = messageId.split(":").pop()!;
    await this.gFetch(`/messages/${gid}/modify`, {
      method: "POST",
      body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
    });
  }

  async delete(messageId: string): Promise<void> {
    const gid = messageId.split(":").pop()!;
    await this.gFetch(`/messages/${gid}/trash`, { method: "POST" });
  }

  async setLabel(messageId: string, label: string, on: boolean): Promise<void> {
    const gid = messageId.split(":").pop()!;
    await this.gFetch(`/messages/${gid}/modify`, {
      method: "POST",
      body: JSON.stringify(on ? { addLabelIds: [label] } : { removeLabelIds: [label] }),
    });
  }

  async search(query: string): Promise<Message[]> {
    const q = new URLSearchParams({ q: query, maxResults: "50" });
    const list = await this.gFetch<{ messages?: { id: string }[] }>(`/messages?${q.toString()}`);
    const ids = list.messages?.map((m) => m.id) ?? [];
    return Promise.all(ids.map((id) => this.get(`${this.account.id}:${id}`)));
  }

  private toMessage(raw: GmailMessageResource): Message {
    const headers = Object.fromEntries(
      (raw.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value]),
    );
    const body = extractBody(raw.payload);
    const labelIds = raw.labelIds ?? [];
    return {
      id: `${this.account.id}:${raw.id}`,
      accountId: this.account.id,
      threadId: `${this.account.id}:${raw.threadId}`,
      from: parseAddr(headers.from ?? ""),
      to: (headers.to ?? "").split(",").filter(Boolean).map(parseAddr),
      cc: (headers.cc ?? "").split(",").filter(Boolean).map(parseAddr),
      bcc: [],
      subject: headers.subject ?? "(no subject)",
      snippet: raw.snippet ?? "",
      body: body.text,
      ...(body.html ? { bodyHtml: body.html } : {}),
      receivedAt: Number(raw.internalDate),
      labels: labelIds,
      flags: {
        unread: labelIds.includes("UNREAD"),
        starred: labelIds.includes("STARRED"),
        archived: !labelIds.includes("INBOX"),
        trashed: labelIds.includes("TRASH"),
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
      const status = res.status;
      const cause: "auth" | "rate_limit" | "network" | "unknown" =
        status === 401 ? "auth" : status === 429 ? "rate_limit" : status >= 500 ? "network" : "unknown";
      throw new ProviderError(
        `Gmail ${path} failed (${status})`,
        cause,
        status >= 500 || status === 429,
      );
    }
    return res.json();
  }
}

interface GmailHeader {
  name: string;
  value: string;
}
interface GmailPart {
  mimeType: string;
  body: { data?: string; size?: number };
  parts?: GmailPart[];
  headers?: GmailHeader[];
}
interface GmailMessageResource {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate: string;
  labelIds?: string[];
  payload?: { headers?: GmailHeader[] } & GmailPart;
}

function extractBody(part?: GmailPart): { text: string; html?: string } {
  if (!part) return { text: "" };
  if (part.body.data && part.mimeType === "text/plain") {
    return { text: decodeBase64Url(part.body.data) };
  }
  if (part.body.data && part.mimeType === "text/html") {
    return { text: "", html: decodeBase64Url(part.body.data) };
  }
  if (part.parts) {
    const text = part.parts.find((p) => p.mimeType === "text/plain");
    const html = part.parts.find((p) => p.mimeType === "text/html");
    return {
      text: text?.body.data ? decodeBase64Url(text.body.data) : "",
      ...(html?.body.data ? { html: decodeBase64Url(html.body.data) } : {}),
    };
  }
  return { text: "" };
}

function decodeBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return atob(b64);
  }
}

function encodeBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function parseAddr(s: string): { email: string; name?: string } {
  const match = s.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1]?.trim();
    const email = match[2]?.trim() ?? "";
    return { ...(name ? { name } : {}), email };
  }
  return { email: s.trim() };
}

function buildRfc822(from: string, draft: Draft): string {
  const to = draft.to.map((a) => (a.name ? `"${a.name}" <${a.email}>` : a.email)).join(", ");
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${draft.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    draft.inReplyToMessageId ? `In-Reply-To: ${draft.inReplyToMessageId}` : "",
  ]
    .filter(Boolean)
    .join("\r\n");
  return `${headers}\r\n\r\n${draft.body}`;
}
