import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * IMAP proxy. Browser cannot speak raw TCP, so this endpoint relays IMAP
 * commands to the user's chosen server using ImapFlow.
 *
 * Phase-1 STUB: validates the request shape only. ImapFlow integration
 * lands with provider-agent.
 */

const ImapRequest = z.discriminatedUnion("op", [
  z.object({ op: z.literal("list"), accountId: z.string(), cursor: z.string().optional() }),
  z.object({ op: z.literal("get"), accountId: z.string(), uid: z.number().int() }),
  z.object({ op: z.literal("send"), accountId: z.string(), rfc822: z.string() }),
  z.object({ op: z.literal("flag"), accountId: z.string(), uid: z.number().int(), flag: z.string(), on: z.boolean() }),
]);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ImapRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
  }

  return NextResponse.json(
    { error: "stub_not_implemented", op: parsed.data.op },
    { status: 501 },
  );
}
