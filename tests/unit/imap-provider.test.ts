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
