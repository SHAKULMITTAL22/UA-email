"use client";
import { getDB } from "@/lib/db/db";
import { getAccount } from "@/lib/accounts/account-store";
import { makeProvider } from "@/lib/providers/factory";
import type { MessageRow } from "@/lib/db/schema";
import { toast } from "sonner";

const DEMO_ACCOUNT_ID = "demo-account";

export async function archiveMessage(m: MessageRow): Promise<void> {
  // Demo account: local-only. The demo messages have ids like
  // "demo-account:demo-1" which aren't valid IMAP UIDs and there's no
  // server to call anyway.
  if (m.accountId === DEMO_ACCOUNT_ID) {
    await getDB().messages.update(m.id, { flags: { ...m.flags, archived: true } });
    return;
  }
  const account = await getAccount(m.accountId);
  if (!account) throw new Error("Account no longer exists");
  const provider = makeProvider(account);
  await provider.archive(m.id);
  await getDB().messages.update(m.id, { flags: { ...m.flags, archived: true } });
}

export async function deleteMessage(m: MessageRow): Promise<void> {
  if (m.accountId === DEMO_ACCOUNT_ID) {
    await getDB().messages.delete(m.id);
    return;
  }
  const account = await getAccount(m.accountId);
  if (!account) throw new Error("Account no longer exists");
  const provider = makeProvider(account);
  await provider.delete(m.id);
  await getDB().messages.delete(m.id);
}

export async function sendReply(replyingTo: MessageRow, body: string): Promise<void> {
  if (replyingTo.accountId === DEMO_ACCOUNT_ID) {
    // Simulate the reply in local Dexie so it appears as a sent message.
    const db = getDB();
    const id = `${DEMO_ACCOUNT_ID}:sent-${Date.now()}`;
    const subject = replyingTo.subject.startsWith("Re:")
      ? replyingTo.subject
      : `Re: ${replyingTo.subject}`;
    await db.messages.put({
      id,
      accountId: DEMO_ACCOUNT_ID,
      threadId: replyingTo.threadId,
      from: { name: "You (demo)", email: "demo@ua-email.dev" },
      to: [replyingTo.from],
      cc: [],
      bcc: [],
      subject,
      snippet: body.slice(0, 200),
      body,
      receivedAt: Date.now(),
      labels: ["Sent"],
      flags: { unread: false, starred: false, archived: true, trashed: false },
    });
    toast.success("Reply sent (demo). Stored locally.");
    return;
  }

  const account = await getAccount(replyingTo.accountId);
  if (!account) throw new Error("Account no longer exists");
  const provider = makeProvider(account);
  const subject = replyingTo.subject.startsWith("Re:")
    ? replyingTo.subject
    : `Re: ${replyingTo.subject}`;
  const recipient =
    replyingTo.from.name !== undefined
      ? { email: replyingTo.from.email, name: replyingTo.from.name }
      : { email: replyingTo.from.email };
  await provider.send({
    to: [recipient],
    subject,
    body,
    inReplyToMessageId: replyingTo.id,
  });
  toast.success("Reply sent");
}
