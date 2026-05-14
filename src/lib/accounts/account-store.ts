"use client";
import { getDB } from "@/lib/db/db";
import { Account } from "@/lib/types/account";

export async function listAccounts(): Promise<Account[]> {
  const db = getDB();
  return db.accounts.toArray();
}

export async function getAccount(id: string): Promise<Account | undefined> {
  const db = getDB();
  return db.accounts.get(id);
}

export async function addAccount(account: Account): Promise<void> {
  const parsed = Account.parse(account);
  const db = getDB();
  await db.accounts.put(parsed);
}

export async function removeAccount(id: string): Promise<void> {
  const db = getDB();
  await db.transaction("rw", [db.accounts, db.messages, db.threads, db.aiResults, db.syncCursors], async () => {
    await db.accounts.delete(id);
    await db.messages.where("accountId").equals(id).delete();
    await db.threads.where("accountId").equals(id).delete();
    await db.aiResults.where("messageId").startsWith(`${id}:`).delete();
    await db.syncCursors.delete(id);
  });
}

export async function updateLastSync(id: string, at: number): Promise<void> {
  const db = getDB();
  await db.accounts.update(id, { lastSyncAt: at });
}
