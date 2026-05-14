"use client";
import { getDB } from "@/lib/db/db";
import { getAccount } from "@/lib/accounts/account-store";
import { makeProvider } from "@/lib/providers/factory";
import type { MessageRow } from "@/lib/db/schema";
import { toast } from "sonner";

export async function archiveMessage(m: MessageRow): Promise<void> {
  const account = await getAccount(m.accountId);
  if (!account) throw new Error("Account no longer exists");
  const provider = makeProvider(account);
  await provider.archive(m.id);
  await getDB().messages.update(m.id, { flags: { ...m.flags, archived: true } });
}

export async function deleteMessage(m: MessageRow): Promise<void> {
  const account = await getAccount(m.accountId);
  if (!account) throw new Error("Account no longer exists");
  const provider = makeProvider(account);
  await provider.delete(m.id);
  await getDB().messages.delete(m.id);
}

export async function sendReply(replyingTo: MessageRow, body: string): Promise<void> {
  const account = await getAccount(replyingTo.accountId);
  if (!account) throw new Error("Account no longer exists");
  const provider = makeProvider(account);
  const subject = replyingTo.subject.startsWith("Re:") ? replyingTo.subject : `Re: ${replyingTo.subject}`;
  const recipient = replyingTo.from.name !== undefined
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
