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

    if (messages.length > 0) {
      const rows: MessageRow[] = messages.map((m) => ({ ...m }));
      await db.messages.bulkPut(rows);
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
