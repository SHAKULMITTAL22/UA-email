import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";
import { triageNewMessages } from "@/lib/sync/triage-batcher";
import { getDB } from "@/lib/db/db";
import type { Message } from "@/lib/types/message";

function fakeMessage(id: string): Message {
  return {
    id, accountId: "acct-1", threadId: "t-" + id,
    from: { email: "a@b.com" }, to: [{ email: "me@me.com" }], cc: [], bcc: [],
    subject: "Subject " + id, snippet: "", body: "body " + id,
    receivedAt: 1_700_000_000_000, labels: [],
    flags: { unread: true, starred: false, archived: false, trashed: false },
  };
}

describe("triageNewMessages", () => {
  beforeEach(async () => {
    const db = getDB();
    await db.delete();
    await db.open();
    server.resetHandlers();
  });

  it("calls /api/ai/triage and writes aiResults + denormalizes bucket onto messages", async () => {
    const db = getDB();
    const msgs = [fakeMessage("m-1"), fakeMessage("m-2")];
    await db.messages.bulkPut(msgs);

    server.use(
      http.post("/api/ai/triage", async ({ request }) => {
        const body = (await request.json()) as { emails: { messageId: string }[] };
        return HttpResponse.json({
          results: body.emails.map((e) => ({
            messageId: e.messageId,
            bucket: "needs_reply",
            summary: "summary " + e.messageId,
            suggestedReply: "reply " + e.messageId,
            model: "claude-test",
            processedAt: 1_700_000_000_000,
            promptCacheHit: true,
            version: 1,
          })),
          model: "claude-test",
          promptCacheHit: true,
          cacheHitRate: 0.5,
        });
      }),
    );

    const out = await triageNewMessages(msgs);
    expect(out.processed).toBe(2);
    expect(out.cacheHitRate).toBe(0.5);

    const results = await db.aiResults.toArray();
    expect(results).toHaveLength(2);
    expect(results[0]?.bucket).toBe("needs_reply");

    const denorm = await db.messages.get("m-1");
    expect(denorm?.bucket).toBe("needs_reply");
    expect(denorm?.promptCacheHit).toBe(true);
  });

  it("returns 0 processed when there are no messages", async () => {
    const out = await triageNewMessages([]);
    expect(out.processed).toBe(0);
  });

  it("does not throw when AI call fails (soft fallback)", async () => {
    server.use(
      http.post("/api/ai/triage", () =>
        HttpResponse.json({ error: "rate_limit" }, { status: 429 })),
    );
    await expect(triageNewMessages([fakeMessage("m-1")])).resolves.toMatchObject({ processed: 0 });
  });
});
