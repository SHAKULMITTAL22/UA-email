"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/db/db";
import type { Account } from "@/lib/types/account";

export function useAccounts(): Account[] | undefined {
  return useLiveQuery(async () => {
    if (typeof indexedDB === "undefined") return [];
    return getDB().accounts.toArray();
  }, []);
}
