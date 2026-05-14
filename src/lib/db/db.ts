import Dexie, { type EntityTable } from "dexie";
import type {
  Tables,
} from "./schema";

class UAEmailDB extends Dexie {
  accounts!: EntityTable<Tables["accounts"], "id">;
  messages!: EntityTable<Tables["messages"], "id">;
  threads!: EntityTable<Tables["threads"], "id">;
  aiResults!: EntityTable<Tables["aiResults"], "messageId">;
  syncCursors!: EntityTable<Tables["syncCursors"], "accountId">;
  settings!: EntityTable<Tables["settings"], "id">;

  constructor() {
    super("ua-email");

    this.version(1).stores({
      accounts: "id, provider, email, lastSyncAt",
      messages:
        "id, accountId, threadId, receivedAt, bucket, [accountId+receivedAt], [accountId+bucket]",
      threads: "id, accountId, updatedAt, [accountId+updatedAt]",
      aiResults: "messageId, processedAt, version",
      syncCursors: "accountId",
      settings: "id",
    });
  }
}

let _db: UAEmailDB | null = null;

/**
 * Lazy singleton. Initialized only in the browser — server-rendered code
 * must not import this module top-level.
 */
export function getDB(): UAEmailDB {
  if (typeof indexedDB === "undefined") {
    throw new Error("getDB() called outside of a browser context");
  }
  if (!_db) _db = new UAEmailDB();
  return _db;
}

/** Test-only: reset the cached instance after wiping data. */
export function _resetDBForTests(): void {
  _db = null;
}
