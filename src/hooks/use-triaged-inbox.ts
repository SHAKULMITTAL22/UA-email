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

    const grouped: Record<string, MessageRow[]> = {
      needs_reply: [],
      fyi: [],
      newsletter: [],
      noise: [],
      unclassified: [],
    };
    for (const m of all) {
      const key = m.bucket ?? "unclassified";
      grouped[key]?.push(m);
    }

    return BUCKET_ORDER.map((b) => ({ bucket: b, messages: grouped[b] ?? [] }));
  }, [activeAccountId]);
}
