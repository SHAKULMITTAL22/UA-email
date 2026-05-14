"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Sparkles, Reply, Send, RotateCw } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useThread } from "@/hooks/use-thread";
import { motion as motionTokens } from "@/styles/motion-tokens";

export function ThreadView({ threadId }: { threadId: string }) {
  const thread = useThread(threadId);
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  if (!thread) return <ThreadSkeleton />;
  if (thread.messages.length === 0) {
    return <div className="text-textMuted">Thread not found.</div>;
  }

  const lastMessage = thread.messages[thread.messages.length - 1]!;
  const lastAi = thread.aiByMessage[lastMessage.id];
  const suggestedReply = lastAi?.suggestedReply ?? null;

  async function regenerate() {
    if (!thread || thread.messages.length === 0) return;
    setDrafting(true);
    try {
      const threadPlaintext = thread.messages
        .map((m) => `From: ${m.from.name ?? m.from.email}\nSubject: ${m.subject}\n\n${m.body}`)
        .join("\n\n---\n\n");
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: {
            id: lastMessage.id,
            threadId: lastMessage.threadId,
            subject: lastMessage.subject,
            body: lastMessage.body,
          },
          threadPlaintext,
        }),
      });
      if (!res.ok) throw new Error("Draft regen failed");
      const data = await res.json();
      setDraft(data.draft);
    } finally {
      setDrafting(false);
    }
  }

  async function send() {
    setSending(true);
    try {
      const { sendReply } = await import("@/lib/actions/message-actions");
      await sendReply(lastMessage, draft || suggestedReply || "");
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  const uniqueFroms = thread.messages
    .map((m) => m.from.email)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(", ");

  return (
    <article className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-textMuted hover:text-textPrimary">
        <ChevronLeft className="h-4 w-4" /> Back to inbox
      </Link>

      <header>
        <h1 className="font-display text-2xl text-textPrimary">{lastMessage.subject}</h1>
        <p className="mt-1 text-sm text-textDim">
          {thread.messages.length} message{thread.messages.length === 1 ? "" : "s"} · {uniqueFroms}
        </p>
      </header>

      <div className="space-y-3">
        {thread.messages.map((m, i) => {
          const ai = thread.aiByMessage[m.id];
          return (
            <motion.section
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: motionTokens.duration.base, delay: i * 0.03, ease: motionTokens.ease.out }}
              className="rounded-card border border-cardBorder bg-card backdrop-blur-card p-4"
            >
              <header className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-textPrimary">{m.from.name ?? m.from.email}</span>
                <span className="text-textDim font-mono text-xs">{new Date(m.receivedAt).toLocaleString()}</span>
              </header>
              {ai && (
                <p className="mt-2 text-xs text-aiAccent italic flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" aria-hidden /> {ai.summary}
                </p>
              )}
              <div className="mt-3 whitespace-pre-wrap text-sm text-textPrimary/90 leading-relaxed">{m.body}</div>
            </motion.section>
          );
        })}
      </div>

      <section aria-labelledby="reply-heading" className="rounded-card border border-aiAccent/30 bg-aiAccent/[0.04] p-4 space-y-3">
        <header className="flex items-center justify-between">
          <h2 id="reply-heading" className="text-sm font-medium text-aiAccent flex items-center gap-1.5">
            <Reply className="h-3.5 w-3.5" /> Suggested reply
          </h2>
          <Button variant="ghost" size="sm" onClick={() => void regenerate()} disabled={drafting}>
            <RotateCw className={`h-3.5 w-3.5 mr-1.5 ${drafting ? "animate-spin" : ""}`} /> Regenerate
          </Button>
        </header>
        <textarea
          value={draft || suggestedReply || ""}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          aria-label="Reply body"
          className="w-full bg-transparent border border-cardBorder rounded-card p-3 text-sm text-textPrimary placeholder:text-textDim resize-none focus:outline-none focus:border-aiAccent/60"
          placeholder={suggestedReply ? "" : "Write a reply…"}
        />
        <div className="flex justify-end">
          <Button onClick={() => void send()} disabled={sending || (!draft && !suggestedReply)}>
            <Send className="h-3.5 w-3.5 mr-1.5" /> {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </section>
    </article>
  );
}

function ThreadSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32 bg-card" />
      <Skeleton className="h-32 w-full bg-card" />
      <Skeleton className="h-32 w-full bg-card opacity-60" />
    </div>
  );
}
