import type { Account } from "@/lib/types/account";
import type { Message, Bucket } from "@/lib/types/message";
import type { Thread } from "@/lib/types/thread";
import type { AiResult } from "@/lib/types/ai";

/**
 * Dexie table row shapes. Bucket-derived fields are denormalized onto messages
 * for fast inbox queries without join cost.
 */
export interface MessageRow extends Message {
  // Denormalized fields for indexing
  bucket?: Bucket;
  promptCacheHit?: boolean;
  aiProcessedAt?: number;
}

export interface SyncCursor {
  accountId: string;
  providerCursor: string;  // historyId for Gmail/Graph, UIDNEXT for IMAP
  lastFullSyncAt: number;
}

export interface AppSettings {
  id: "singleton";
  llmProvider: "anthropic" | "openai" | "gemini";
  byok: {
    anthropic?: string;
    openai?: string;
    gemini?: string;
  };
  syncIntervalSec: number;
  hardenedMode: boolean;  // when true, tokens encrypted with passphrase
  /** Persisted last-verified state so the green banner survives refresh. */
  lastVerified?: {
    provider: "anthropic" | "openai" | "gemini";
    model: string;
    /** Last 8 chars of the key used, for staleness check. */
    keySuffix: string;
    at: number;
  };
}

export type Tables = {
  accounts: Account;
  messages: MessageRow;
  threads: Thread;
  aiResults: AiResult;
  syncCursors: SyncCursor;
  settings: AppSettings;
};
