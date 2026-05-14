import { describe, it, expect, beforeEach } from "vitest";
import { getDB } from "@/lib/db/db";
import type { Account } from "@/lib/types/account";
import type { MessageRow } from "@/lib/db/schema";

describe("Dexie schema v1", () => {
  beforeEach(async () => {
    const db = getDB();
    await db.delete();
    await db.open();
  });

  it("persists and reads back an account", async () => {
    const db = getDB();
    const acct: Account = {
      id: "acct-1",
      provider: "gmail",
      email: "shakul@example.com",
      label: "Personal",
      lastSyncAt: null,
    };
    await db.accounts.put(acct);

    const round = await db.accounts.get("acct-1");
    expect(round).toEqual(acct);
  });

  it("indexes messages by [accountId+receivedAt] for chronological inbox", async () => {
    const db = getDB();
    const messages: MessageRow[] = [
      makeMsg("m-1", "acct-1", 1000),
      makeMsg("m-2", "acct-1", 3000),
      makeMsg("m-3", "acct-1", 2000),
    ];
    await db.messages.bulkPut(messages);

    const ordered = await db.messages
      .where("[accountId+receivedAt]")
      .between(["acct-1", 0], ["acct-1", Number.MAX_SAFE_INTEGER])
      .toArray();

    expect(ordered.map((m) => m.id)).toEqual(["m-1", "m-3", "m-2"]);
  });

  it("indexes messages by [accountId+bucket] for triage queries", async () => {
    const db = getDB();
    await db.messages.bulkPut([
      makeMsg("m-1", "acct-1", 1000, "needs_reply"),
      makeMsg("m-2", "acct-1", 2000, "fyi"),
      makeMsg("m-3", "acct-1", 3000, "needs_reply"),
    ]);

    const needsReply = await db.messages
      .where("[accountId+bucket]")
      .equals(["acct-1", "needs_reply"])
      .toArray();

    expect(needsReply.map((m) => m.id).sort()).toEqual(["m-1", "m-3"]);
  });
});

function makeMsg(
  id: string,
  accountId: string,
  receivedAt: number,
  bucket?: "needs_reply" | "fyi" | "newsletter" | "noise",
): MessageRow {
  return {
    id,
    accountId,
    threadId: `t-${id}`,
    from: { email: "x@y.com" },
    to: [{ email: "me@me.com" }],
    cc: [],
    bcc: [],
    subject: "s",
    snippet: "",
    body: "",
    receivedAt,
    labels: [],
    flags: { unread: true, starred: false, archived: false, trashed: false },
    ...(bucket ? { bucket } : {}),
  };
}
