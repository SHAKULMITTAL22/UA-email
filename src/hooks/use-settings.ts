"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/db/db";
import type { AppSettings } from "@/lib/db/schema";

const DEFAULTS: AppSettings = {
  id: "singleton",
  llmProvider: "anthropic",
  byok: {},
  syncIntervalSec: 60,
  hardenedMode: false,
};

export function useSettings(): { settings: AppSettings; update: (patch: Partial<AppSettings>) => Promise<void> } {
  const current = useLiveQuery(async () => {
    if (typeof indexedDB === "undefined") return DEFAULTS;
    const db = getDB();
    const existing = await db.settings.get("singleton");
    if (!existing) await db.settings.put(DEFAULTS);
    return existing ?? DEFAULTS;
  }, []);

  async function update(patch: Partial<AppSettings>) {
    const db = getDB();
    const cur = (await db.settings.get("singleton")) ?? DEFAULTS;
    await db.settings.put({ ...cur, ...patch, id: "singleton" });
  }

  return { settings: current ?? DEFAULTS, update };
}
