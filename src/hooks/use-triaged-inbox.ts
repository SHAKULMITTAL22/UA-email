"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/db/db";
import type { Bucket } from "@/lib/types/message";
import type { MessageRow } from "@/lib/db/schema";

export interface TriagedBucket {
  bucket: Bucket | "unclassified";
  messages: MessageRow[];
}

const BUCKET_ORDER: (Bucket | "unclassified")[] = [
  "needs_reply",
  "fyi",
  "newsletter",
  "noise",
  "unclassified",
];

export function useTriagedInbox(activeAccountId?: string | "unified"): TriagedBucket[] | undefined {
  return useLiveQuery(async () => {
    if (typeof indexedDB === "undefined") {
      return BUCKET_ORDER.map((b) => ({ bucket: b, messages: [] }));
    }

    const db = getDB();
    let all: MessageRow[];

    if (!activeAccountId || activeAccountId === "unified") {
      all = await db.messages.orderBy("receivedAt").reverse().toArray();
    } else {
      all = await db.messages
        .where("[accountId+receivedAt]")
        .between([activeAccountId, 0], [activeAccountId, Number.MAX_SAFE_INTEGER])
        .reverse()
        .toArray();
    }

    // Exclude archived / trashed from the main bucket views. They live in
    // their own dedicated views (useStateMessages).
    const inbox = all.filter((m) => !m.flags.archived && !m.flags.trashed);

    const grouped: Record<string, MessageRow[]> = {
      needs_reply: [],
      fyi: [],
      newsletter: [],
      noise: [],
      unclassified: [],
    };
    for (const m of inbox) {
      const key = m.bucket ?? "unclassified";
      grouped[key]?.push(m);
    }

    return BUCKET_ORDER.map((b) => ({ bucket: b, messages: grouped[b] ?? [] }));
  }, [activeAccountId]);
}

/**
 * Returns messages in the requested state (archived or trashed) for the
 * active account, newest first. Used by the dedicated Archive / Trash views.
 */
export function useStateMessages(
  state: "archived" | "trashed",
  activeAccountId?: string | "unified",
): MessageRow[] | undefined {
  return useLiveQuery(async () => {
    if (typeof indexedDB === "undefined") return [];
    const db = getDB();
    const all =
      !activeAccountId || activeAccountId === "unified"
        ? await db.messages.orderBy("receivedAt").reverse().toArray()
        : await db.messages
            .where("[accountId+receivedAt]")
            .between([activeAccountId, 0], [activeAccountId, Number.MAX_SAFE_INTEGER])
            .reverse()
            .toArray();

    if (state === "archived") {
      // Archived but not trashed (trashed is a stricter state)
      return all.filter((m) => m.flags.archived && !m.flags.trashed);
    }
    return all.filter((m) => m.flags.trashed);
  }, [state, activeAccountId]);
}
