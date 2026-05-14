"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/db/db";
import type { MessageRow } from "@/lib/db/schema";
import type { AiResult } from "@/lib/types/ai";

export function useThread(threadId: string): { messages: MessageRow[]; aiByMessage: Record<string, AiResult> } | undefined {
  return useLiveQuery(async () => {
    if (typeof indexedDB === "undefined") return { messages: [], aiByMessage: {} };
    const db = getDB();
    const messages = await db.messages.where("threadId").equals(threadId).sortBy("receivedAt");
    const ids = messages.map((m) => m.id);
    const aiResults = ids.length === 0 ? [] : await db.aiResults.where("messageId").anyOf(ids).toArray();
    const aiByMessage: Record<string, AiResult> = {};
    for (const r of aiResults) aiByMessage[r.messageId] = r;
    return { messages, aiByMessage };
  }, [threadId]);
}
