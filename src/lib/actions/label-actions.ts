"use client";
import { getDB } from "@/lib/db/db";
import { getAccount } from "@/lib/accounts/account-store";
import { makeProvider } from "@/lib/providers/factory";
import type { MessageRow } from "@/lib/db/schema";
import { toast } from "sonner";

const DEMO_ACCOUNT_ID = "demo-account";

export async function applyLabel(m: MessageRow, label: string, on: boolean): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) return;

  if (m.accountId === DEMO_ACCOUNT_ID) {
    const next = on
      ? Array.from(new Set([...m.labels, trimmed]))
      : m.labels.filter((l) => l !== trimmed);
    await getDB().messages.update(m.id, { labels: next });
    toast.success(on ? `Added label "${trimmed}"` : `Removed label "${trimmed}"`);
    return;
  }

  const account = await getAccount(m.accountId);
  if (!account) throw new Error("Account no longer exists");
  const provider = makeProvider(account);
  try {
    await provider.setLabel(m.id, trimmed, on);
    const next = on
      ? Array.from(new Set([...m.labels, trimmed]))
      : m.labels.filter((l) => l !== trimmed);
    await getDB().messages.update(m.id, { labels: next });
    toast.success(on ? `Added label "${trimmed}"` : `Removed label "${trimmed}"`);
  } catch (e) {
    toast.error(`Label change failed: ${e instanceof Error ? e.message : "unknown"}`);
  }
}
