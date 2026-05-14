import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";
import { syncAccount } from "@/lib/sync/sync-engine";
import { getDB } from "@/lib/db/db";
import type { Account } from "@/lib/types/account";

const imapAccount: Account = {
  id: "acct-sync-1",
  provider: "imap",
  email: "demo@example.com",
  label: "Demo",
  imapCreds: { host: "imap.example.com", port: 993, secure: true, user: "demo", pass: "p" },
  lastSyncAt: null,
};

describe("syncAccount", () => {
  beforeEach(async () => {
    const db = getDB();
    await db.delete();
    await db.open();
    await db.accounts.put(imapAccount);
    server.resetHandlers();
  });

  it("fetches new messages and writes them to IndexedDB", async () => {
    server.use(
      http.post("/api/imap", () =>
        HttpResponse.json({
          messages: [
            {
              uid: 1, messageId: "<m1>", threadId: "<m1>",
              from: { email: "a@b.com" }, to: [{ email: "demo@example.com" }], cc: [],
              subject: "First", snippet: "snip1", body: "body1",
              receivedAt: 1_700_000_000_000, flags: { unread: true, flagged: false }, labels: [],
            },
          ],
        })),
    );

    const result = await syncAccount(imapAccount);
    expect(result.errored).toBe(false);
    expect(result.fetched).toBe(1);
    expect(result.newMessages).toHaveLength(1);

    const stored = await getDB().messages.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.subject).toBe("First");
  });

  it("only returns truly new messages on second sync", async () => {
    server.use(
      http.post("/api/imap", () =>
        HttpResponse.json({
          messages: [
            { uid: 1, messageId: "<m1>", threadId: "<m1>",
              from: { email: "a@b.com" }, to: [{ email: "demo@example.com" }], cc: [],
              subject: "First", snippet: "", body: "", receivedAt: 1_700_000_000_000,
              flags: { unread: true, flagged: false }, labels: [] },
          ],
        })),
    );

    await syncAccount(imapAccount);
    const second = await syncAccount(imapAccount);
    expect(second.fetched).toBe(1);
    expect(second.newMessages).toHaveLength(0);
  });

  it("reports errored=true on provider failure", async () => {
    server.use(
      http.post("/api/imap", () =>
        HttpResponse.json({ error: "imap_error", message: "auth failed" }, { status: 401 })),
    );

    const result = await syncAccount(imapAccount);
    expect(result.errored).toBe(true);
    expect(result.errorReason).toContain("auth");
  });
});
