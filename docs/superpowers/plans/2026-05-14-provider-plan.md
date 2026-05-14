# UA-Email · Provider Plan (Phase 2 · Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship working email-provider integration end-to-end. After this plan: a user can add an IMAP account via the UI, the app fetches real messages from their server, and stores them in IndexedDB. Then we wire Gmail + Outlook OAuth through the same `MailProvider` interface.

**Why IMAP first:** Zero OAuth-verification dependency. The user (and the recruiter, with an app password) can demo this *today*. Gmail/Outlook OAuth follows the same interface — adding them is incremental.

**Tech additions:** `imapflow`, `mailparser`, `googleapis`-style `fetch` calls (no SDK — we use the REST API directly from the browser using stored tokens), `@microsoft/microsoft-graph-client` or direct REST.

---

## File Structure (additions to foundation)

```
src/lib/providers/
├── mail-provider.ts                       (EXISTS — interface)
├── factory.ts                              ← Task 7 — provider lookup by accountId
├── imap/
│   ├── imap-provider.ts                    ← Task 5 — browser-side MailProvider impl
│   └── imap-server.ts                      ← Task 2 — server-side ImapFlow wrapper
├── gmail/
│   └── gmail-provider.ts                   ← Task 11 — REST direct from browser
└── outlook/
    └── outlook-provider.ts                 ← Task 12 — Graph REST direct from browser

src/app/api/imap/route.ts                   (EXISTS — extend in Tasks 3-4)

src/lib/accounts/
├── account-store.ts                        ← Task 6 — Dexie CRUD for accounts
├── crypto.ts                                ← Task 8 — WebCrypto AES-GCM helpers
└── imap-server-presets.ts                  ← Task 9 — domain → server lookup

src/components/
├── add-account-dialog.tsx                  ← Task 10 — three-button picker + IMAP form
└── account-switcher.tsx                    (EXISTS — extend in Task 10)

tests/unit/
├── imap-provider.test.ts                   ← Task 5 — MSW-mocked ImapProvider
├── account-store.test.ts                   ← Task 6
├── crypto.test.ts                          ← Task 8
└── gmail-provider.test.ts                  ← Task 11
```

---

## Task 1: Install IMAP server-side dependencies

**Files:** `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1.1 — Install**

```bash
pnpm add imapflow mailparser
pnpm add -D @types/mailparser
```

- [ ] **Step 1.2 — Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "[provider-agent] chore(deps): imapflow + mailparser for server-side IMAP relay

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Server-side IMAP wrapper (`imap-server.ts`)

**Files:** Create `src/lib/providers/imap/imap-server.ts`

- [ ] **Step 2.1 — Create the server-side wrapper**

```ts
import { ImapFlow, type ImapFlowOptions, type FetchMessageObject } from "imapflow";
import { simpleParser } from "mailparser";

export interface ImapConnectOpts {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface ImapMessage {
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

/**
 * Open a short-lived IMAP connection, execute one operation, close.
 * Vercel serverless functions are stateless — no connection pooling.
 */
async function withConnection<T>(
  opts: ImapConnectOpts,
  mailbox: string,
  op: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const config: ImapFlowOptions = {
    host: opts.host,
    port: opts.port,
    secure: opts.secure,
    auth: { user: opts.user, pass: opts.pass },
    logger: false,
    socketTimeout: 30_000,
  };
  const client = new ImapFlow(config);
  await client.connect();
  try {
    const lock = await client.getMailboxLock(mailbox);
    try {
      return await op(client);
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function listMessages(
  opts: ImapConnectOpts,
  mailbox = "INBOX",
  sinceUid?: number,
  limit = 50,
): Promise<{ messages: ImapMessage[]; nextCursor?: string }> {
  return withConnection(opts, mailbox, async (client) => {
    const range = sinceUid ? `${sinceUid}:*` : `*:*`;
    const messages: ImapMessage[] = [];
    let lastUid = sinceUid ?? 0;

    let count = 0;
    for await (const msg of client.fetch(range, { envelope: true, flags: true, source: true, uid: true })) {
      if (count >= limit) break;
      const parsed = await parseMessage(msg);
      messages.push(parsed);
      lastUid = msg.uid;
      count++;
    }

    return {
      messages,
      nextCursor: messages.length === limit ? String(lastUid + 1) : undefined,
    };
  });
}

export async function getMessage(
  opts: ImapConnectOpts,
  uid: number,
  mailbox = "INBOX",
): Promise<ImapMessage | null> {
  return withConnection(opts, mailbox, async (client) => {
    const msg = await client.fetchOne(uid, { envelope: true, flags: true, source: true, uid: true });
    if (!msg) return null;
    return parseMessage(msg as FetchMessageObject);
  });
}

export async function sendRaw(
  opts: ImapConnectOpts,
  rfc822: string,
  sentMailbox = "Sent",
): Promise<void> {
  // Most IMAP servers don't actually send mail — they accept APPEND to Sent.
  // Real-world sending uses SMTP, which is the same credential pair for
  // Gmail/Outlook/Yahoo/AOL. Phase-2.1 ships SMTP via nodemailer.
  await withConnection(opts, sentMailbox, async (client) => {
    await client.append(sentMailbox, rfc822, ["\\Seen"]);
  });
}

export async function setFlag(
  opts: ImapConnectOpts,
  uid: number,
  flag: string,
  on: boolean,
  mailbox = "INBOX",
): Promise<void> {
  await withConnection(opts, mailbox, async (client) => {
    if (on) await client.messageFlagsAdd(uid, [flag]);
    else await client.messageFlagsRemove(uid, [flag]);
  });
}

async function parseMessage(msg: FetchMessageObject): Promise<ImapMessage> {
  const parsed = await simpleParser(msg.source ?? Buffer.from(""));
  const env = msg.envelope;

  return {
    uid: msg.uid,
    messageId: env.messageId ?? `<uid-${msg.uid}@imap>`,
    threadId: env.inReplyTo ?? env.messageId ?? `<uid-${msg.uid}@imap>`,
    from: addrOf(env.from?.[0]),
    to: (env.to ?? []).map(addrOf),
    cc: (env.cc ?? []).map(addrOf),
    subject: env.subject ?? "(no subject)",
    snippet: parsed.text?.slice(0, 200) ?? "",
    body: parsed.text ?? "",
    ...(parsed.html ? { bodyHtml: parsed.html } : {}),
    receivedAt: (env.date ?? new Date()).getTime(),
    flags: {
      unread: !(msg.flags?.has("\\Seen") ?? false),
      flagged: msg.flags?.has("\\Flagged") ?? false,
    },
    labels: [...(msg.flags ?? [])].filter((f) => !f.startsWith("\\")),
  };
}

function addrOf(env?: { address?: string; name?: string }): { email: string; name?: string } {
  return {
    email: env?.address ?? "unknown@example.com",
    ...(env?.name ? { name: env.name } : {}),
  };
}
```

- [ ] **Step 2.2 — Typecheck**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 2.3 — Commit**

```bash
git add src/lib/providers/imap/imap-server.ts
git commit -m "[provider-agent] feat(imap): server-side ImapFlow wrapper (list/get/send/flag)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Wire `/api/imap` to the real wrapper

**Files:** Replace `src/app/api/imap/route.ts`

- [ ] **Step 3.1 — Replace the stub with the real handler**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listMessages,
  getMessage,
  sendRaw,
  setFlag,
  type ImapConnectOpts,
} from "@/lib/providers/imap/imap-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const ImapCreds = z.object({
  host: z.string().min(1),
  port: z.number().int(),
  secure: z.boolean(),
  user: z.string().min(1),
  pass: z.string().min(1),
});

const Request = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("list"),
    accountId: z.string(),
    creds: ImapCreds,
    mailbox: z.string().optional(),
    sinceUid: z.number().int().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  z.object({
    op: z.literal("get"),
    accountId: z.string(),
    creds: ImapCreds,
    uid: z.number().int(),
    mailbox: z.string().optional(),
  }),
  z.object({
    op: z.literal("send"),
    accountId: z.string(),
    creds: ImapCreds,
    rfc822: z.string(),
  }),
  z.object({
    op: z.literal("flag"),
    accountId: z.string(),
    creds: ImapCreds,
    uid: z.number().int(),
    flag: z.string(),
    on: z.boolean(),
    mailbox: z.string().optional(),
  }),
]);

export async function POST(req: globalThis.Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = Request.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const creds: ImapConnectOpts = data.creds;

  try {
    switch (data.op) {
      case "list": {
        const result = await listMessages(
          creds,
          data.mailbox ?? "INBOX",
          data.sinceUid,
          data.limit ?? 50,
        );
        return NextResponse.json(result);
      }
      case "get": {
        const result = await getMessage(creds, data.uid, data.mailbox ?? "INBOX");
        if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });
        return NextResponse.json(result);
      }
      case "send": {
        await sendRaw(creds, data.rfc822);
        return NextResponse.json({ ok: true });
      }
      case "flag": {
        await setFlag(creds, data.uid, data.flag, data.on, data.mailbox ?? "INBOX");
        return NextResponse.json({ ok: true });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const lower = message.toLowerCase();
    const status = lower.includes("auth") || lower.includes("login")
      ? 401
      : lower.includes("timeout") || lower.includes("network")
        ? 502
        : 500;
    return NextResponse.json(
      { error: "imap_error", message, retryable: status === 502 },
      { status },
    );
  }
}
```

- [ ] **Step 3.2 — Verify build**

```bash
pnpm build
```

Expected: `/api/imap` route compiles. `nodejs` runtime forced (ImapFlow uses Node net APIs — does not run on edge).

- [ ] **Step 3.3 — Commit**

```bash
git add src/app/api/imap/route.ts
git commit -m "[provider-agent] feat(imap): wire /api/imap to real ImapFlow operations

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Browser-side `ImapProvider` implementing `MailProvider`

**Files:** Create `src/lib/providers/imap/imap-provider.ts`

- [ ] **Step 4.1 — Create the browser-side class**

```ts
import type { Account, ImapCreds } from "@/lib/types/account";
import type { Message } from "@/lib/types/message";
import {
  type MailProvider,
  type Draft,
  type ListResult,
  ProviderError,
} from "@/lib/providers/mail-provider";

interface ImapApiResponse<T> {
  ok: boolean;
  data?: T;
  status: number;
}

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
    const messages: Message[] = res.messages.map((m: ImapServerMessage) => this.toMessage(m));
    return { messages, ...(res.nextCursor ? { nextCursor: res.nextCursor } : {}) };
  }

  async get(messageId: string): Promise<Message> {
    const uid = this.uidFromMessageId(messageId);
    const res = await this.call("get", {
      accountId: this.account.id,
      creds: this.creds,
      uid,
    });
    return this.toMessage(res);
  }

  async send(draft: Draft): Promise<{ messageId: string }> {
    const rfc822 = buildRfc822(this.account.email, draft);
    const res = await this.call("send", {
      accountId: this.account.id,
      creds: this.creds,
      rfc822,
    });
    return { messageId: res.messageId ?? `local-${Date.now()}` };
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
    // Phase-2.1 stub: client-side filter on the cached list.
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
```

- [ ] **Step 4.2 — Typecheck**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 4.3 — Commit**

```bash
git add src/lib/providers/imap/imap-provider.ts
git commit -m "[provider-agent] feat(imap): browser-side ImapProvider implementing MailProvider

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Unit tests for ImapProvider with MSW

**Files:** Create `tests/unit/imap-provider.test.ts`

- [ ] **Step 5.1 — Write tests**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";
import { ImapProvider } from "@/lib/providers/imap/imap-provider";
import type { Account } from "@/lib/types/account";

const account: Account = {
  id: "acct-imap-1",
  provider: "imap",
  email: "demo@example.com",
  label: "Demo IMAP",
  imapCreds: {
    host: "imap.example.com",
    port: 993,
    secure: true,
    user: "demo@example.com",
    pass: "app-password-xxxx",
  },
  lastSyncAt: null,
};

describe("ImapProvider", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it("list() returns messages mapped to canonical shape", async () => {
    server.use(
      http.post("/api/imap", async ({ request }) => {
        const body = (await request.json()) as { op: string };
        expect(body.op).toBe("list");
        return HttpResponse.json({
          messages: [
            {
              uid: 42,
              messageId: "<m1@example.com>",
              threadId: "<m1@example.com>",
              from: { email: "alice@example.com", name: "Alice" },
              to: [{ email: "demo@example.com" }],
              cc: [],
              subject: "Hello",
              snippet: "Hi there",
              body: "Hi there\n\nA.",
              receivedAt: 1_700_000_000_000,
              flags: { unread: true, flagged: false },
              labels: [],
            },
          ],
          nextCursor: undefined,
        });
      }),
    );

    const provider = new ImapProvider(account);
    const { messages } = await provider.list({});
    expect(messages).toHaveLength(1);
    expect(messages[0]?.id).toBe("acct-imap-1:42");
    expect(messages[0]?.subject).toBe("Hello");
    expect(messages[0]?.flags.unread).toBe(true);
  });

  it("get() returns a single message", async () => {
    server.use(
      http.post("/api/imap", async ({ request }) => {
        const body = (await request.json()) as { op: string; uid: number };
        expect(body.op).toBe("get");
        expect(body.uid).toBe(42);
        return HttpResponse.json({
          uid: 42,
          messageId: "<m1@example.com>",
          threadId: "<m1@example.com>",
          from: { email: "alice@example.com" },
          to: [{ email: "demo@example.com" }],
          cc: [],
          subject: "Hello",
          snippet: "Hi there",
          body: "Hi there\n\nA.",
          receivedAt: 1_700_000_000_000,
          flags: { unread: false, flagged: false },
          labels: [],
        });
      }),
    );

    const provider = new ImapProvider(account);
    const msg = await provider.get("acct-imap-1:42");
    expect(msg.id).toBe("acct-imap-1:42");
  });

  it("maps 401 to ProviderError cause=auth", async () => {
    server.use(
      http.post("/api/imap", () =>
        HttpResponse.json({ error: "imap_error", message: "AUTHENTICATIONFAILED" }, { status: 401 }),
      ),
    );
    const provider = new ImapProvider(account);
    await expect(provider.list({})).rejects.toMatchObject({ cause: "auth" });
  });

  it("maps 502 to ProviderError cause=network with retryable=true", async () => {
    server.use(
      http.post("/api/imap", () =>
        HttpResponse.json({ error: "imap_error", message: "timeout", retryable: true }, { status: 502 }),
      ),
    );
    const provider = new ImapProvider(account);
    await expect(provider.list({})).rejects.toMatchObject({ cause: "network", retryable: true });
  });
});
```

- [ ] **Step 5.2 — Run tests**

```bash
pnpm test:unit
```

Expected: 9 total tests passing (5 prior + 4 new).

- [ ] **Step 5.3 — Commit**

```bash
git add tests/unit/imap-provider.test.ts
git commit -m "[test-agent] test(imap): ImapProvider mapping + error-cause classification

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Account store + factory

**Files:** Create `src/lib/accounts/account-store.ts`, `src/lib/providers/factory.ts`

- [ ] **Step 6.1 — Create the account store**

```ts
"use client";
import { getDB } from "@/lib/db/db";
import { Account } from "@/lib/types/account";

export async function listAccounts(): Promise<Account[]> {
  const db = getDB();
  return db.accounts.toArray();
}

export async function getAccount(id: string): Promise<Account | undefined> {
  const db = getDB();
  return db.accounts.get(id);
}

export async function addAccount(account: Account): Promise<void> {
  const parsed = Account.parse(account);
  const db = getDB();
  await db.accounts.put(parsed);
}

export async function removeAccount(id: string): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.accounts, db.messages, db.threads, db.aiResults, db.syncCursors, async () => {
    await db.accounts.delete(id);
    await db.messages.where("accountId").equals(id).delete();
    await db.threads.where("accountId").equals(id).delete();
    await db.aiResults.where("messageId").startsWith(`${id}:`).delete();
    await db.syncCursors.delete(id);
  });
}

export async function updateLastSync(id: string, at: number): Promise<void> {
  const db = getDB();
  await db.accounts.update(id, { lastSyncAt: at });
}
```

- [ ] **Step 6.2 — Create the provider factory**

```ts
import type { Account } from "@/lib/types/account";
import type { MailProvider } from "@/lib/providers/mail-provider";
import { ImapProvider } from "@/lib/providers/imap/imap-provider";
// Phase-2 follow-up imports for Gmail + Outlook land in Task 11/12.

export function makeProvider(account: Account): MailProvider {
  switch (account.provider) {
    case "imap":
      return new ImapProvider(account);
    case "gmail":
      throw new Error("GmailProvider not implemented yet (Task 11)");
    case "outlook":
      throw new Error("OutlookProvider not implemented yet (Task 12)");
  }
}
```

- [ ] **Step 6.3 — Commit**

```bash
git add src/lib/accounts/account-store.ts src/lib/providers/factory.ts
git commit -m "[pwa-agent] feat(accounts): Dexie-backed account store + provider factory

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: IMAP server presets (auto-detect by domain)

**Files:** Create `src/lib/accounts/imap-server-presets.ts`

- [ ] **Step 7.1 — Create presets**

```ts
export interface ImapPreset {
  host: string;
  port: number;
  secure: boolean;
  noteForUser: string;
}

const PRESETS: Record<string, ImapPreset> = {
  "gmail.com":   { host: "imap.gmail.com",       port: 993, secure: true, noteForUser: "Use a Google App Password (not your account password). Generate at https://myaccount.google.com/apppasswords." },
  "googlemail.com": { host: "imap.gmail.com",    port: 993, secure: true, noteForUser: "Use a Google App Password." },
  "outlook.com": { host: "outlook.office365.com", port: 993, secure: true, noteForUser: "Use an app password — enable Modern Authentication in your Microsoft account first." },
  "hotmail.com": { host: "outlook.office365.com", port: 993, secure: true, noteForUser: "Use an app password." },
  "live.com":    { host: "outlook.office365.com", port: 993, secure: true, noteForUser: "Use an app password." },
  "office365.com": { host: "outlook.office365.com", port: 993, secure: true, noteForUser: "Use an app password." },
  "yahoo.com":   { host: "imap.mail.yahoo.com",  port: 993, secure: true, noteForUser: "Generate an app password at https://login.yahoo.com/account/security." },
  "aol.com":     { host: "imap.aol.com",         port: 993, secure: true, noteForUser: "Generate an app password at https://login.aol.com/account/security." },
};

export function presetForEmail(email: string): ImapPreset | undefined {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return undefined;
  return PRESETS[domain];
}
```

- [ ] **Step 7.2 — Commit**

```bash
git add src/lib/accounts/imap-server-presets.ts
git commit -m "[provider-agent] feat(imap): server presets for Gmail, Outlook, Yahoo, AOL

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Add Account dialog (UI)

**Files:** Create `src/components/add-account-dialog.tsx`, modify `src/components/account-switcher.tsx`

- [ ] **Step 8.1 — Create the dialog component**

```tsx
"use client";

import { useState } from "react";
import { Mail, AtSign, Lock, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { addAccount } from "@/lib/accounts/account-store";
import { presetForEmail } from "@/lib/accounts/imap-server-presets";
import { toast } from "sonner";
import { ImapProvider } from "@/lib/providers/imap/imap-provider";
import type { Account } from "@/lib/types/account";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountAdded?: () => void;
}

export function AddAccountDialog({ open, onOpenChange, onAccountAdded }: Props) {
  const [mode, setMode] = useState<"choose" | "imap">("choose");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preset = email.includes("@") ? presetForEmail(email) : undefined;

  async function handleImapSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!preset) {
      setError("Couldn't auto-detect server for this domain. Custom IMAP is not yet supported.");
      return;
    }

    const account: Account = {
      id: crypto.randomUUID(),
      provider: "imap",
      email,
      label: label || `IMAP — ${email}`,
      imapCreds: {
        host: preset.host,
        port: preset.port,
        secure: preset.secure,
        user: email,
        pass,
      },
      lastSyncAt: null,
    };

    setSubmitting(true);
    try {
      const provider = new ImapProvider(account);
      await provider.list({ limit: 1 });
      await addAccount(account);
      toast.success(`Connected to ${email}`);
      onAccountAdded?.();
      onOpenChange(false);
      setEmail(""); setPass(""); setLabel(""); setMode("choose");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {mode === "choose" ? "Add an account" : "Connect via IMAP"}
          </DialogTitle>
          <DialogDescription className="text-textMuted">
            {mode === "choose"
              ? "Three ways in. IMAP works for everyone with an app password."
              : "Use an app password — never your real account password."}
          </DialogDescription>
        </DialogHeader>

        {mode === "choose" ? (
          <div className="space-y-2 py-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled
              title="Coming in Phase 2.2"
            >
              <Mail className="mr-2 h-4 w-4" /> Sign in with Google (coming soon)
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled
              title="Coming in Phase 2.2"
            >
              <Mail className="mr-2 h-4 w-4" /> Sign in with Microsoft (coming soon)
            </Button>
            <Separator className="my-3" />
            <Button
              className="w-full justify-start"
              onClick={() => setMode("imap")}
            >
              <Lock className="mr-2 h-4 w-4" /> Connect via IMAP
            </Button>
          </div>
        ) : (
          <form onSubmit={handleImapSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textDim" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  placeholder="you@gmail.com"
                />
              </div>
              {preset && (
                <p className="text-xs text-textMuted">
                  Detected: <span className="font-mono">{preset.host}:{preset.port}</span>
                </p>
              )}
              {email.includes("@") && !preset && (
                <p className="text-xs text-bucket-newsletter">
                  Domain not in preset list. Custom IMAP servers coming later.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pass">App password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textDim" />
                <Input
                  id="pass"
                  type="password"
                  required
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className="pl-9 font-mono"
                  placeholder="xxxx xxxx xxxx xxxx"
                />
              </div>
              {preset && <p className="text-xs text-textMuted">{preset.noteForUser}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="label">Label (optional)</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Personal · Work · etc."
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-card border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={() => setMode("choose")} disabled={submitting}>
                Back
              </Button>
              <Button type="submit" disabled={submitting || !preset}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting…
                  </>
                ) : (
                  "Connect"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 8.2 — Wire AccountSwitcher to the dialog**

Replace the `Add account` button in `src/components/account-switcher.tsx` with an inline `<AddAccountDialog>` consumer. The full replacement file:

```tsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listAccounts } from "@/lib/accounts/account-store";
import { AddAccountDialog } from "@/components/add-account-dialog";
import type { Account } from "@/lib/types/account";

interface Props {
  activeAccountId?: string | "unified";
  onChange?: (id: string | "unified") => void;
}

export function AccountSwitcher({ activeAccountId = "unified", onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);

  async function refresh() {
    if (typeof indexedDB === "undefined") return;
    setAccounts(await listAccounts());
  }

  useEffect(() => { refresh(); }, []);

  const active =
    activeAccountId === "unified"
      ? { id: "unified", email: accounts.length ? "All accounts" : "No accounts yet", label: "Unified Inbox" }
      : accounts.find((a) => a.id === activeAccountId);

  return (
    <>
      <div className="relative inline-block">
        <Button
          variant="ghost"
          className="gap-2 text-textPrimary"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <Inbox className="h-4 w-4 text-aiAccent" aria-hidden />
          <span className="font-display italic text-lg">{active?.label ?? "No account"}</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </Button>

        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            role="listbox"
            className="absolute left-0 top-full z-10 mt-2 w-72 rounded-drawer border border-cardBorder bg-card backdrop-blur-card p-1"
          >
            <SwitcherItem
              label="Unified Inbox"
              sub={accounts.length ? `${accounts.length} account${accounts.length === 1 ? "" : "s"}` : "No accounts yet"}
              onClick={() => { onChange?.("unified"); setOpen(false); }}
              active={activeAccountId === "unified"}
            />
            {accounts.map((a) => (
              <SwitcherItem
                key={a.id}
                label={a.label}
                sub={a.email}
                onClick={() => { onChange?.(a.id); setOpen(false); }}
                active={a.id === activeAccountId}
              />
            ))}
            <li className="mt-1 border-t border-cardBorder pt-1">
              <button
                onClick={() => { setOpen(false); setAddOpen(true); }}
                className="flex w-full items-center gap-2 rounded-card px-3 py-2 text-sm text-aiAccent hover:bg-white/5"
              >
                <Plus className="h-4 w-4" />
                Add account
              </button>
            </li>
          </motion.ul>
        )}
      </div>

      <AddAccountDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAccountAdded={refresh}
      />
    </>
  );
}

function SwitcherItem({ label, sub, active, onClick }: { label: string; sub: string; active?: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        role="option"
        aria-selected={active}
        className={cn(
          "flex w-full flex-col items-start rounded-card px-3 py-2 text-left transition-colors hover:bg-white/5",
          active && "bg-white/5",
        )}
      >
        <span className="text-sm text-textPrimary">{label}</span>
        <span className="text-xs text-textMuted">{sub}</span>
      </button>
    </li>
  );
}
```

- [ ] **Step 8.3 — Verify build**

```bash
pnpm exec tsc --noEmit && pnpm build
```

- [ ] **Step 8.4 — Commit**

```bash
git add src/components/add-account-dialog.tsx src/components/account-switcher.tsx
git commit -m "[ui-agent] feat(accounts): Add Account dialog (IMAP form + OAuth placeholders)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: E2E test — open Add Account dialog, see IMAP form

**Files:** Create `tests/e2e/add-account.spec.ts`

- [ ] **Step 9.1 — Write the test**

```ts
import { test, expect } from "@playwright/test";

test.describe("Add account flow", () => {
  test("can open Add Account dialog and see IMAP form", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Unified Inbox/i }).click();
    await page.getByRole("button", { name: /Add account/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/Three ways in/i)).toBeVisible();

    await page.getByRole("button", { name: /Connect via IMAP/i }).click();
    await expect(page.getByLabel(/Email address/i)).toBeVisible();
    await expect(page.getByLabel(/App password/i)).toBeVisible();
  });

  test("auto-detects gmail.com IMAP server preset", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Unified Inbox/i }).click();
    await page.getByRole("button", { name: /Add account/i }).click();
    await page.getByRole("button", { name: /Connect via IMAP/i }).click();

    await page.getByLabel(/Email address/i).fill("test@gmail.com");
    await expect(page.getByText(/imap\.gmail\.com:993/i)).toBeVisible();
    await expect(page.getByText(/Google App Password/i)).toBeVisible();
  });
});
```

- [ ] **Step 9.2 — Run e2e**

```bash
pnpm test:e2e --project=chromium
```

Expected: 5 passing total (3 prior + 2 new).

- [ ] **Step 9.3 — Commit**

```bash
git add tests/e2e/add-account.spec.ts
git commit -m "[test-agent] test(e2e): Add Account dialog opens, IMAP form renders, preset detected

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Auth.js handoff implementation + GmailProvider + OutlookProvider

(This task pulls the Phase-2.2 OAuth work forward. Skip for v1 demo if time-constrained — IMAP path is sufficient.)

**Files:**
- Modify: `src/lib/auth.ts` (real JWT/session callbacks)
- Modify: `src/app/api/auth/handoff/route.ts` (real implementation)
- Create: `src/lib/providers/gmail/gmail-provider.ts`
- Create: `src/lib/providers/outlook/outlook-provider.ts`
- Modify: `src/lib/providers/factory.ts` (wire in Gmail + Outlook)
- Modify: `src/components/add-account-dialog.tsx` (enable Google/Microsoft buttons)

- [ ] **Step 10.1 — Update `src/lib/auth.ts` so the JWT callback persists tokens AND session exposes a `tokenSig` for the handoff endpoint**

```ts
import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Microsoft from "next-auth/providers/microsoft-entra-id";
import { env } from "@/lib/env";

declare module "next-auth" {
  interface Session {
    user: { providerId?: string } & DefaultSession["user"];
    handoffReady?: boolean;
  }
}

const providers = [];

if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  );
}

if (env.AUTH_MICROSOFT_ID && env.AUTH_MICROSOFT_SECRET) {
  providers.push(
    Microsoft({
      clientId: env.AUTH_MICROSOFT_ID,
      clientSecret: env.AUTH_MICROSOFT_SECRET,
      issuer: `https://login.microsoftonline.com/${env.AUTH_MICROSOFT_TENANT_ID}/v2.0`,
      authorization: {
        params: {
          scope: "openid email profile offline_access Mail.ReadWrite Mail.Send User.Read",
        },
      },
    }),
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  trustHost: true,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.providerId = account.provider;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        token.scope = account.scope;
      }
      if (profile?.email) token.email = profile.email;
      return token;
    },
    async session({ session, token }) {
      session.user = { ...session.user, providerId: token.providerId as string | undefined };
      session.handoffReady = !!(token as { accessToken?: string }).accessToken;
      return session;
    },
  },
});
```

- [ ] **Step 10.2 — Replace `src/app/api/auth/handoff/route.ts`**

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getToken } from "next-auth/jwt";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!env.AUTH_SECRET) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 501 });
  }
  const token = await getToken({
    req: req as unknown as Parameters<typeof getToken>[0]["req"],
    secret: env.AUTH_SECRET,
  });
  if (!token) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const payload = {
    provider: token.providerId,
    email: token.email,
    accessToken: (token as { accessToken?: string }).accessToken,
    refreshToken: (token as { refreshToken?: string }).refreshToken,
    expiresAt: (token as { expiresAt?: number }).expiresAt,
    scope: (token as { scope?: string }).scope,
  };

  const c = await cookies();
  for (const cookie of c.getAll()) {
    if (cookie.name.startsWith("authjs.") || cookie.name.startsWith("__Secure-authjs.")) {
      c.delete(cookie.name);
    }
  }

  return NextResponse.json(payload);
}
```

- [ ] **Step 10.3 — Create `src/lib/providers/gmail/gmail-provider.ts`**

```ts
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
    const ids = list.messages?.map(m => m.id) ?? [];
    const messages = await Promise.all(ids.map(id => this.get(`${this.account.id}:${id}`)));
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
    const encoded = btoa(unescape(encodeURIComponent(rfc))).replace(/\+/g, "-").replace(/\//g, "_");
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
    const ids = list.messages?.map(m => m.id) ?? [];
    return Promise.all(ids.map(id => this.get(`${this.account.id}:${id}`)));
  }

  private toMessage(raw: GmailMessageResource): Message {
    const headers = Object.fromEntries(
      (raw.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value]),
    );
    const body = extractBody(raw.payload);
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
      labels: raw.labelIds ?? [],
      flags: {
        unread: (raw.labelIds ?? []).includes("UNREAD"),
        starred: (raw.labelIds ?? []).includes("STARRED"),
        archived: !((raw.labelIds ?? []).includes("INBOX")),
        trashed: (raw.labelIds ?? []).includes("TRASH"),
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
      const cause = status === 401 ? "auth" : status === 429 ? "rate_limit" : status >= 500 ? "network" : "unknown";
      throw new ProviderError(`Gmail ${path} failed (${status})`, cause as "auth" | "rate_limit" | "network" | "unknown", status >= 500 || status === 429);
    }
    return res.json();
  }
}

interface GmailHeader { name: string; value: string }
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
    const text = part.parts.find(p => p.mimeType === "text/plain");
    const html = part.parts.find(p => p.mimeType === "text/html");
    return {
      text: text?.body.data ? decodeBase64Url(text.body.data) : "",
      ...(html?.body.data ? { html: decodeBase64Url(html.body.data) } : {}),
    };
  }
  return { text: "" };
}

function decodeBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  try { return decodeURIComponent(escape(atob(b64))); } catch { return atob(b64); }
}

function parseAddr(s: string): { email: string; name?: string } {
  const match = s.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1]?.trim() || undefined as string | undefined, email: match[2]?.trim() ?? "" } as { email: string; name?: string };
  return { email: s.trim() };
}

function buildRfc822(from: string, draft: Draft): string {
  const to = draft.to.map(a => a.name ? `"${a.name}" <${a.email}>` : a.email).join(", ");
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${draft.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    draft.inReplyToMessageId ? `In-Reply-To: ${draft.inReplyToMessageId}` : "",
  ].filter(Boolean).join("\r\n");
  return `${headers}\r\n\r\n${draft.body}`;
}
```

- [ ] **Step 10.4 — Create `src/lib/providers/outlook/outlook-provider.ts`**

```ts
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
          toRecipients: draft.to.map(a => ({ emailAddress: { address: a.email, ...(a.name ? { name: a.name } : {}) } })),
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
    return {
      id: `${this.account.id}:${raw.id}`,
      accountId: this.account.id,
      threadId: `${this.account.id}:${raw.conversationId}`,
      from: { email: raw.from?.emailAddress?.address ?? "unknown@unknown", ...(raw.from?.emailAddress?.name ? { name: raw.from.emailAddress.name } : {}) },
      to: (raw.toRecipients ?? []).map(r => ({ email: r.emailAddress.address, ...(r.emailAddress.name ? { name: r.emailAddress.name } : {}) })),
      cc: (raw.ccRecipients ?? []).map(r => ({ email: r.emailAddress.address })),
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
      const cause = res.status === 401 ? "auth" : res.status === 429 ? "rate_limit" : res.status >= 500 ? "network" : "unknown";
      throw new ProviderError(`Graph ${path} failed (${res.status})`, cause as "auth" | "rate_limit" | "network" | "unknown", res.status >= 500 || res.status === 429);
    }
    if (res.status === 204) return undefined as unknown as T;
    return res.json();
  }
}

interface GraphAddress { emailAddress: { address: string; name?: string } }
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

function stripHtml(s: string): string { return s.replace(/<[^>]+>/g, "").trim(); }
```

- [ ] **Step 10.5 — Update factory + enable OAuth buttons in Add Account dialog**

Replace `src/lib/providers/factory.ts`:

```ts
import type { Account } from "@/lib/types/account";
import type { MailProvider } from "@/lib/providers/mail-provider";
import { ImapProvider } from "@/lib/providers/imap/imap-provider";
import { GmailProvider } from "@/lib/providers/gmail/gmail-provider";
import { OutlookProvider } from "@/lib/providers/outlook/outlook-provider";

export function makeProvider(account: Account): MailProvider {
  switch (account.provider) {
    case "imap": return new ImapProvider(account);
    case "gmail": return new GmailProvider(account);
    case "outlook": return new OutlookProvider(account);
  }
}
```

In `src/components/add-account-dialog.tsx`, replace the two `disabled` OAuth buttons with active versions that route to `/api/auth/signin/google` or `/api/auth/signin/microsoft-entra-id`. The flow: button click → `signIn(provider)` from `next-auth/react` → after redirect-back, the home page calls `/api/auth/handoff` once, receives tokens, calls `addAccount()`, refreshes the list.

```tsx
// Add at the top of the file:
import { signIn } from "next-auth/react";

// Replace the two disabled OAuth buttons with:
<Button variant="outline" className="w-full justify-start" onClick={() => signIn("google", { callbackUrl: "/?auth=callback" })}>
  <Mail className="mr-2 h-4 w-4 text-aiAccent" /> Sign in with Google
</Button>
<Button variant="outline" className="w-full justify-start" onClick={() => signIn("microsoft-entra-id", { callbackUrl: "/?auth=callback" })}>
  <Mail className="mr-2 h-4 w-4 text-aiAccent" /> Sign in with Microsoft
</Button>
```

In `src/app/page.tsx`, add a `useEffect` that detects `?auth=callback` and runs the handoff:

```tsx
"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AccountSwitcher } from "@/components/account-switcher";
import { TriagedInboxView } from "@/components/triaged-inbox-view";
import { addAccount } from "@/lib/accounts/account-store";
import { toast } from "sonner";

export default function HomePage() {
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("auth") !== "callback") return;
    (async () => {
      try {
        const res = await fetch("/api/auth/handoff", { method: "POST" });
        if (!res.ok) return;
        const t = await res.json();
        await addAccount({
          id: crypto.randomUUID(),
          provider: t.provider === "google" ? "gmail" : "outlook",
          email: t.email,
          label: t.email,
          oauthTokens: {
            accessToken: t.accessToken,
            refreshToken: t.refreshToken,
            expiresAt: t.expiresAt,
            scope: t.scope ?? "",
          },
          lastSyncAt: null,
        });
        toast.success(`Connected ${t.email}`);
        // Clean URL
        history.replaceState(null, "", "/");
      } catch (e) {
        toast.error("Handoff failed: " + (e instanceof Error ? e.message : "unknown"));
      }
    })();
  }, [params]);

  return (
    <main className="space-y-8">
      <div className="flex items-center justify-between">
        <AccountSwitcher />
      </div>
      <TriagedInboxView loading />
    </main>
  );
}
```

- [ ] **Step 10.6 — Install `next-auth/react` for client signIn**

(`next-auth` is already installed; the `/react` subpath is part of it. No new install needed.)

- [ ] **Step 10.7 — Verify build**

```bash
pnpm exec tsc --noEmit && pnpm build
```

- [ ] **Step 10.8 — Commit all of Task 10 changes as ONE commit**

```bash
git add src/lib/auth.ts src/app/api/auth/handoff/route.ts src/lib/providers/gmail src/lib/providers/outlook src/lib/providers/factory.ts src/components/add-account-dialog.tsx src/app/page.tsx
git commit -m "[provider-agent] feat(oauth): real Auth.js handoff + GmailProvider + OutlookProvider

Wires up the OAuth half of the provider plan. Sign-in buttons now route
through Auth.js to Google/Microsoft; handoff endpoint returns tokens
once and clears server cookies. Browser stores tokens in IndexedDB.

GmailProvider uses REST direct from browser. OutlookProvider uses
Microsoft Graph. Both implement the MailProvider contract identically
to ImapProvider.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §5 MailProvider — ✓ all three implementations
- §10 Failure modes (Gmail/Graph/IMAP error handling) — ✓ ProviderError cause classification
- §14 Auth flows (test-mode OAuth, IMAP app password) — ✓ both paths
- §7.4 Search — Phase-2.1 stub (client-side filter); full implementation deferred to ui-screens-plan

**Type consistency:**
- All providers return `Message` with `${accountId}:${providerId}` composite IDs.
- `ProviderError` cause classification matches across all three implementations.

**Placeholders scanned:** Task 10's GmailProvider has a comment "// Phase-2.1 stub: client-side filter on the cached list" — that's documented, not a TODO. Task 9 `crypto.ts` (hardened-mode encryption) is not in scope here — moved to a Phase-2.3 follow-up plan since the foundation defaults to convenience mode per §4.

---

## Execution Handoff

Plan complete. Saved to `docs/superpowers/plans/2026-05-14-provider-plan.md`.

**Subagent-Driven execution** chosen by default per Phase-1 precedent.
