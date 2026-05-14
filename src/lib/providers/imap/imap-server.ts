import { ImapFlow, type ImapFlowOptions, type FetchMessageObject } from "imapflow";
import { simpleParser } from "mailparser";

export interface ImapConnectOpts {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface ImapMessage {
  uid: number;
  messageId: string;
  threadId: string;
  from: { email: string; name?: string };
  to: { email: string; name?: string }[];
  cc: { email: string; name?: string }[];
  subject: string;
  snippet: string;
  body: string;
  bodyHtml?: string;
  receivedAt: number;
  flags: { unread: boolean; flagged: boolean };
  labels: string[];
}

/**
 * Open a short-lived IMAP connection, execute one operation, close.
 * Vercel serverless functions are stateless — no connection pooling.
 */
async function withConnection<T>(
  opts: ImapConnectOpts,
  mailbox: string,
  op: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const config: ImapFlowOptions = {
    host: opts.host,
    port: opts.port,
    secure: opts.secure,
    auth: { user: opts.user, pass: opts.pass },
    logger: false,
    socketTimeout: 30_000,
  };
  const client = new ImapFlow(config);
  await client.connect();
  try {
    const lock = await client.getMailboxLock(mailbox);
    try {
      return await op(client);
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function listMessages(
  opts: ImapConnectOpts,
  mailbox = "INBOX",
  sinceUid?: number,
  limit = 50,
): Promise<{ messages: ImapMessage[]; nextCursor?: string }> {
  return withConnection(opts, mailbox, async (client) => {
    const range = sinceUid ? `${sinceUid}:*` : `*:*`;
    const messages: ImapMessage[] = [];
    let lastUid = sinceUid ?? 0;

    let count = 0;
    for await (const msg of client.fetch(range, { envelope: true, flags: true, source: true, uid: true })) {
      if (count >= limit) break;
      const parsed = await parseMessage(msg);
      messages.push(parsed);
      lastUid = msg.uid;
      count++;
    }

    return {
      messages,
      ...(messages.length === limit ? { nextCursor: String(lastUid + 1) } : {}),
    };
  });
}

export async function getMessage(
  opts: ImapConnectOpts,
  uid: number,
  mailbox = "INBOX",
): Promise<ImapMessage | null> {
  return withConnection(opts, mailbox, async (client) => {
    const msg = await client.fetchOne(uid, { envelope: true, flags: true, source: true, uid: true });
    if (!msg) return null;
    return parseMessage(msg as FetchMessageObject);
  });
}

export async function sendRaw(
  opts: ImapConnectOpts,
  rfc822: string,
  sentMailbox = "Sent",
): Promise<void> {
  // Most IMAP servers don't actually send mail — they accept APPEND to Sent.
  // Real-world sending uses SMTP, which is the same credential pair for
  // Gmail/Outlook/Yahoo/AOL. Phase-2.1 ships SMTP via nodemailer.
  await withConnection(opts, sentMailbox, async (client) => {
    await client.append(sentMailbox, rfc822, ["\\Seen"]);
  });
}

export async function setFlag(
  opts: ImapConnectOpts,
  uid: number,
  flag: string,
  on: boolean,
  mailbox = "INBOX",
): Promise<void> {
  await withConnection(opts, mailbox, async (client) => {
    if (on) await client.messageFlagsAdd(uid, [flag]);
    else await client.messageFlagsRemove(uid, [flag]);
  });
}

async function parseMessage(msg: FetchMessageObject): Promise<ImapMessage> {
  const parsed = await simpleParser(msg.source ?? Buffer.from(""));
  const env = msg.envelope ?? {};

  return {
    uid: msg.uid,
    messageId: env.messageId ?? `<uid-${msg.uid}@imap>`,
    threadId: env.inReplyTo ?? env.messageId ?? `<uid-${msg.uid}@imap>`,
    from: addrOf(env.from?.[0]),
    to: (env.to ?? []).map(addrOf),
    cc: (env.cc ?? []).map(addrOf),
    subject: env.subject ?? "(no subject)",
    snippet: parsed.text?.slice(0, 200) ?? "",
    body: parsed.text ?? "",
    ...(parsed.html ? { bodyHtml: parsed.html } : {}),
    receivedAt: (env.date ?? new Date()).getTime(),
    flags: {
      unread: !(msg.flags?.has("\\Seen") ?? false),
      flagged: msg.flags?.has("\\Flagged") ?? false,
    },
    labels: [...(msg.flags ?? [])].filter((f) => !f.startsWith("\\")),
  };
}

function addrOf(env?: { address?: string; name?: string }): { email: string; name?: string } {
  return {
    email: env?.address ?? "unknown@example.com",
    ...(env?.name ? { name: env.name } : {}),
  };
}
