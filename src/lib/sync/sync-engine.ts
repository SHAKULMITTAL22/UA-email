import { getDB } from "@/lib/db/db";
import type { Account } from "@/lib/types/account";
import type { Message } from "@/lib/types/message";
import type { MessageRow } from "@/lib/db/schema";
import { makeProvider } from "@/lib/providers/factory";

export interface SyncResult {
  accountId: string;
  fetched: number;
  newMessages: Message[];
  errored: boolean;
  errorReason?: string;
}

export interface LoadOlderResult {
  fetched: number;
  hasMore: boolean;
}

// Demo account id is a sentinel — its messages are seeded locally;
// no remote IMAP server exists to connect to.
const DEMO_ACCOUNT_ID = "demo-account";

/**
 * Fetch the latest page for one account, diff against IndexedDB, return the
 * new messages so the caller can ship them to the AI batcher.
 */
export async function syncAccount(account: Account, limit = 50): Promise<SyncResult> {
  if (account.id === DEMO_ACCOUNT_ID) {
    return { accountId: account.id, fetched: 0, newMessages: [], errored: false };
  }
  const db = getDB();
  try {
    const provider = makeProvider(account);
    const { messages } = await provider.list({ limit });

    const existingIds = new Set(
      (await db.messages.where("accountId").equals(account.id).primaryKeys()) as string[],
    );

    const newMessages = messages.filter((m) => !existingIds.has(m.id));

    // CRITICAL: only put NEW rows. bulkPut overwrites entire rows including
    // denormalized AI fields (bucket, aiProcessedAt, promptCacheHit). If we
    // re-put existing messages from a fresh IMAP fetch, we'd wipe their
    // classifications and force a re-triage on every refresh.
    if (newMessages.length > 0) {
      const rows: MessageRow[] = newMessages.map((m) => ({ ...m }));
      await db.messages.bulkPut(rows);
    }

    // For existing rows, only patch the flags field (read/unread/starred may
    // have changed remotely). Never touch bucket/summary/aiProcessedAt.
    const existingFresh = messages.filter((m) => existingIds.has(m.id));
    if (existingFresh.length > 0) {
      await db.transaction("rw", db.messages, async () => {
        for (const m of existingFresh) {
          await db.messages.update(m.id, { flags: m.flags });
        }
      });
    }

    await db.accounts.update(account.id, { lastSyncAt: Date.now() });

    return {
      accountId: account.id,
      fetched: messages.length,
      newMessages,
      errored: false,
    };
  } catch (err) {
    return {
      accountId: account.id,
      fetched: 0,
      newMessages: [],
      errored: true,
      errorReason: err instanceof Error ? err.message : "unknown",
    };
  }
}

/**
 * Page backwards from the stored providerCursor and persist the next cursor
 * for subsequent calls. Used by the "Load older messages" UI affordance.
 */
export async function loadOlder(account: Account): Promise<LoadOlderResult> {
  if (account.id === DEMO_ACCOUNT_ID) {
    return { fetched: 0, hasMore: false };
  }
  const db = getDB();
  const cursor = await db.syncCursors.get(account.id);
  const provider = makeProvider(account);

  try {
    const { messages, nextCursor } = await provider.list({
      ...(cursor?.providerCursor ? { cursor: cursor.providerCursor } : {}),
      limit: 50,
    });
    if (messages.length === 0) {
      return { fetched: 0, hasMore: false };
    }

    const rows: MessageRow[] = messages.map((m) => ({ ...m }));
    await db.messages.bulkPut(rows);

    if (nextCursor) {
      await db.syncCursors.put({
        accountId: account.id,
        providerCursor: nextCursor,
        lastFullSyncAt: Date.now(),
      });
    }

    return { fetched: messages.length, hasMore: Boolean(nextCursor) };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "loadOlder failed");
  }
}
