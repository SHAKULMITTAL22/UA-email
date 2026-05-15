"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Sparkles, Reply, Send, RotateCw, Forward, Plus, X } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ComposeDrawer } from "@/components/compose-drawer";
import { MessageBody } from "@/components/message-body";
import { useThread } from "@/hooks/use-thread";
import { useSettings } from "@/hooks/use-settings";
import { applyLabel } from "@/lib/actions/label-actions";
import { motion as motionTokens } from "@/styles/motion-tokens";
import { toast } from "sonner";

export function ThreadView({ threadId }: { threadId: string }) {
  const thread = useThread(threadId);
  const { settings } = useSettings();
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);

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
      const byok = settings.byok[settings.llmProvider];
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.llmProvider,
          ...(byok ? { byok } : {}),
          email: {
            id: lastMessage.id,
            threadId: lastMessage.threadId,
            subject: lastMessage.subject,
            body: lastMessage.body,
          },
          threadPlaintext,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        const reason = body.message ?? body.error ?? `HTTP ${res.status}`;
        toast.error(`Draft regen failed (${body.error ?? "unknown"}): ${reason}`);
        return;
      }
      const data = await res.json();
      setDraft(data.draft);
    } catch (e) {
      toast.error(`Draft regen failed: ${e instanceof Error ? e.message : "unknown"}`);
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
    .map((m) => m.from.name ?? m.from.email)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(", ");

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-textMuted transition-colors hover:text-aiAccent"
      >
        <ChevronLeft className="h-4 w-4" /> Back to inbox
      </Link>

      <header className="space-y-3 border-b border-cardBorder pb-6">
        <h1 className="font-display text-3xl leading-tight text-textPrimary sm:text-4xl">
          {lastMessage.subject}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-textMuted">
          <span className="font-mono text-xs">
            {thread.messages.length} message{thread.messages.length === 1 ? "" : "s"}
          </span>
          <span className="text-textDim">·</span>
          <span className="truncate">{uniqueFroms}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {lastMessage.labels.map((l) => (
            <span
              key={l}
              className="inline-flex items-center gap-1 rounded border border-aiAccentBorder bg-aiAccentSoft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-aiAccentDeep"
            >
              {l}
              <button
                onClick={() => void applyLabel(lastMessage, l, false)}
                aria-label={`Remove label ${l}`}
                className="text-aiAccentDeep/60 hover:text-error"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <LabelAdder onAdd={(name) => void applyLabel(lastMessage, name, true)} />
        </div>
      </header>

      <div className="space-y-3">
        {thread.messages.map((m, i) => {
          const ai = thread.aiByMessage[m.id];
          const isLatest = i === thread.messages.length - 1;
          const initial = (m.from.name?.[0] ?? m.from.email[0] ?? "?").toUpperCase();
          return (
            <motion.section
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: motionTokens.duration.base,
                delay: i * 0.03,
                ease: motionTokens.ease.out,
              }}
              className="overflow-hidden rounded-card border border-cardBorder bg-card shadow-card"
            >
              <header className="flex items-start gap-3 border-b border-cardBorder p-4">
                <div
                  aria-hidden
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-aiAccentSoft text-sm font-semibold text-aiAccent"
                >
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium text-textPrimary">
                      {m.from.name ?? m.from.email}
                    </span>
                    <span className="flex-shrink-0 font-mono text-xs text-textDim">
                      {new Date(m.receivedAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {m.from.name && (
                    <div className="truncate font-mono text-xs text-textDim">{m.from.email}</div>
                  )}
                  {m.to.length > 0 && (
                    <div className="mt-0.5 truncate text-xs text-textMuted">
                      to {m.to.map((a) => a.name ?? a.email).join(", ")}
                    </div>
                  )}
                </div>
              </header>

              {isLatest && ai && (ai.detailedSummary || ai.summary) && (
                <div className="border-b border-aiAccentBorder bg-aiAccentSoft/40 p-4">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-aiAccent" aria-hidden />
                    <div className="flex-1 space-y-1">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-aiAccent">
                        AI summary
                      </div>
                      <p className="font-display text-sm italic leading-relaxed text-aiAccentDeep">
                        {ai.detailedSummary ?? ai.summary}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!isLatest && ai && (
                <div className="border-b border-cardBorder px-4 py-2">
                  <p className="flex items-center gap-1.5 font-display text-xs italic text-aiAccent">
                    <Sparkles className="h-3 w-3" aria-hidden /> {ai.summary}
                  </p>
                </div>
              )}

              <div className="p-4 text-sm leading-relaxed">
                <MessageBody bodyText={m.body} {...(m.bodyHtml ? { bodyHtml: m.bodyHtml } : {})} />
              </div>
            </motion.section>
          );
        })}
      </div>

      <section
        aria-labelledby="reply-heading"
        className="space-y-3 rounded-card border border-aiAccentBorder bg-aiAccentSoft p-4 shadow-card"
      >
        <header className="flex items-center justify-between">
          <h2
            id="reply-heading"
            className="flex items-center gap-1.5 font-display text-lg italic text-aiAccentDeep"
          >
            <Reply className="h-4 w-4 text-aiAccent" /> Suggested reply
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
          className="w-full resize-none rounded-card border border-cardBorder bg-canvasSecondary p-3 text-sm text-textPrimary placeholder:text-textDim focus:border-aiAccent focus:outline-none focus:ring-1 focus:ring-aiAccent/30"
          placeholder={suggestedReply ? "" : "Write a reply…"}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setForwardOpen(true)}>
            <Forward className="h-3.5 w-3.5 mr-1.5" /> Forward
          </Button>
          <Button onClick={() => void send()} disabled={sending || (!draft && !suggestedReply)}>
            <Send className="h-3.5 w-3.5 mr-1.5" /> {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </section>

      <ComposeDrawer
        open={forwardOpen}
        onOpenChange={setForwardOpen}
        initial={{
          accountId: lastMessage.accountId,
          subject: lastMessage.subject.toLowerCase().startsWith("fwd:")
            ? lastMessage.subject
            : `Fwd: ${lastMessage.subject}`,
          body: `\n\n---------- Forwarded message ----------\nFrom: ${lastMessage.from.name ?? ""} <${lastMessage.from.email}>\nDate: ${new Date(lastMessage.receivedAt).toUTCString()}\nSubject: ${lastMessage.subject}\nTo: ${lastMessage.to.map((t) => t.email).join(", ")}\n\n${lastMessage.body}`,
        }}
      />
    </article>
  );
}

function ThreadSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Skeleton className="h-8 w-32 skeleton-shimmer" />
      <Skeleton className="h-32 w-full skeleton-shimmer" />
      <Skeleton className="h-32 w-full skeleton-shimmer opacity-70" />
    </div>
  );
}

function LabelAdder({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  function commit() {
    const trimmed = value.trim();
    if (trimmed) {
      onAdd(trimmed);
    }
    setValue("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add label"
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-aiAccent/40 px-2 py-0.5 text-[10px] font-medium tracking-wide text-aiAccentDeep/80 transition-colors hover:border-aiAccent hover:text-aiAccentDeep"
      >
        <Plus className="h-2.5 w-2.5" /> label
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            setValue("");
            setOpen(false);
          }
        }}
        autoFocus
        placeholder="label name"
        aria-label="New label name"
        className="h-6 w-32 text-xs px-1.5"
      />
      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={commit}>
        Add
      </Button>
    </span>
  );
}
