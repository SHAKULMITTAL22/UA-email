import type { TriageInput, ReplyContext } from "@/lib/ai/llm-provider";

export const TRIAGE_SYSTEM = `You triage email for a busy professional.

Classify every email into exactly one bucket:
- "needs_reply": personal correspondence requiring a response from the user
- "fyi": informational mail (status updates, notifications about user actions) — no reply needed
- "newsletter": promotional, marketing, digests, automated subscriptions
- "noise": low-signal automated mail (CI/build notifications, system noise, unverifiable senders)

For each email, write a single concise summary line (max 120 chars, present tense, factual — not "this email is about X"; instead "X happened" or "Y is asking for Z").

For "needs_reply" only, draft a suggested reply (max 300 chars). The reply should be warm-direct, sound like a busy adult, and address what was asked. For other buckets, suggestedReply = null.

Return ONLY a JSON object matching this schema, no prose:

{
  "results": [
    { "messageId": "<id>", "bucket": "needs_reply|fyi|newsletter|noise", "summary": "...", "suggestedReply": "..." or null }
  ]
}

Return results in the same order as the input. If a message looks suspicious or empty, classify as "noise" with summary "Empty or unparseable message".`;

export function triageUserPrompt(emails: TriageInput[]): string {
  const blocks = emails
    .map(
      (e, i) =>
        `<email id="${e.messageId}" idx="${i}">
From: ${e.from}
Subject: ${e.subject}
Received: ${new Date(e.receivedAt).toISOString()}
Body:
${e.bodyExcerpt.slice(0, 2000)}
</email>`,
    )
    .join("\n\n");

  return `Here are ${emails.length} emails to triage:\n\n${blocks}\n\nReturn the JSON object now.`;
}

export const DRAFT_REPLY_SYSTEM = `You draft email replies on behalf of a busy professional.

Style:
- Warm-direct: friendly, but no fluff. No "I hope this finds you well" openers.
- Match the inbound message's register (formal → formal; casual → casual).
- ~120 words or less unless the thread genuinely demands more.
- Plain text, no Markdown.
- Sign off as the user signs off based on prior messages in the thread; if no signal, just first name or nothing.

Return ONLY the body of the reply (no subject line, no greeting/farewell unless natural).`;

export function draftReplyUserPrompt(threadPlaintext: string, tone?: ReplyContext["tone"]): string {
  const toneNote = tone ? `\n\nUse a "${tone}" tone.` : "";
  return `Below is the email thread you're replying to (newest message at the bottom). Draft a reply to the most recent message.${toneNote}\n\n<thread>\n${threadPlaintext}\n</thread>\n\nReturn the reply body now.`;
}
