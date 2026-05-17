import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listMessages,
  getMessage,
  sendRaw,
  setFlag,
  type ImapConnectOpts,
} from "@/lib/providers/imap/imap-server";
import { sendViaSmtp } from "@/lib/providers/imap/smtp-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const ImapCreds = z.object({
  host: z.string().min(1),
  port: z.number().int(),
  secure: z.boolean(),
  user: z.string().min(1),
  pass: z.string().min(1),
});

const Request = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("list"),
    accountId: z.string(),
    creds: ImapCreds,
    mailbox: z.string().optional(),
    sinceUid: z.number().int().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  z.object({
    op: z.literal("get"),
    accountId: z.string(),
    creds: ImapCreds,
    uid: z.number().int(),
    mailbox: z.string().optional(),
  }),
  z.object({
    op: z.literal("send"),
    accountId: z.string(),
    creds: ImapCreds,
    rfc822: z.string(),
  }),
  z.object({
    op: z.literal("smtp-send"),
    accountId: z.string(),
    creds: ImapCreds,
    rfc822: z.string(),
    fromAddress: z.string(),
    toAddresses: z.array(z.string()).min(1),
  }),
  z.object({
    op: z.literal("flag"),
    accountId: z.string(),
    creds: ImapCreds,
    uid: z.number().int(),
    flag: z.string(),
    on: z.boolean(),
    mailbox: z.string().optional(),
  }),
]);

export async function POST(req: globalThis.Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = Request.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const creds: ImapConnectOpts = data.creds;

  try {
    switch (data.op) {
      case "list": {
        const result = await listMessages(
          creds,
          data.mailbox ?? "INBOX",
          data.sinceUid,
          data.limit ?? 50,
        );
        return NextResponse.json(result);
      }
      case "get": {
        const result = await getMessage(creds, data.uid, data.mailbox ?? "INBOX");
        if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });
        return NextResponse.json(result);
      }
      case "send": {
        // Legacy: APPEND-to-Sent only. Kept for callers that explicitly want
        // to store a copy without actually delivering. New code uses smtp-send.
        await sendRaw(creds, data.rfc822);
        return NextResponse.json({ ok: true });
      }
      case "smtp-send": {
        // Real send: SMTP via nodemailer using same creds, host derived from
        // the IMAP host (Gmail/Yahoo/AOL/Outlook). Also APPENDs to Sent so
        // the message shows up in the user's Sent folder when they next log
        // into Gmail/Outlook.
        const result = await sendViaSmtp(
          {
            imapHost: creds.host,
            user: creds.user,
            pass: creds.pass,
          },
          data.rfc822,
          data.fromAddress,
          data.toAddresses,
        );
        // Best-effort: APPEND to Sent. If the IMAP server doesn't have a Sent
        // folder (rare), we don't fail the send.
        try {
          await sendRaw(creds, data.rfc822);
        } catch {
          // intentionally ignored
        }
        return NextResponse.json({ ok: true, messageId: result.messageId });
      }
      case "flag": {
        await setFlag(creds, data.uid, data.flag, data.on, data.mailbox ?? "INBOX");
        return NextResponse.json({ ok: true });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const lower = message.toLowerCase();
    const status = lower.includes("auth") || lower.includes("login")
      ? 401
      : lower.includes("timeout") || lower.includes("network")
        ? 502
        : 500;
    return NextResponse.json(
      { error: "imap_error", message, retryable: status === 502 },
      { status },
    );
  }
}
