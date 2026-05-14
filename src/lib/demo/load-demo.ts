"use client";
import { getDB } from "@/lib/db/db";
import { DEMO_ACCOUNT, DEMO_ACCOUNT_ID, buildSeedRecords } from "@/lib/demo/seed-data";

export async function loadDemoInbox(): Promise<void> {
  const db = getDB();
  const { messages, aiResults } = buildSeedRecords();
  await db.transaction("rw", [db.accounts, db.messages, db.aiResults], async () => {
    await db.accounts.put(DEMO_ACCOUNT);
    await db.messages.bulkPut(messages);
    await db.aiResults.bulkPut(aiResults);
  });
}

export async function clearDemoInbox(): Promise<void> {
  const db = getDB();
  await db.transaction("rw", [db.accounts, db.messages, db.aiResults], async () => {
    await db.accounts.delete(DEMO_ACCOUNT_ID);
    await db.messages.where("accountId").equals(DEMO_ACCOUNT_ID).delete();
    await db.aiResults.where("messageId").startsWith(`${DEMO_ACCOUNT_ID}:`).delete();
  });
}
