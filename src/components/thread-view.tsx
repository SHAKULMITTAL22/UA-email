"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Sparkles, Reply, Send, RotateCw, Forward, Plus, X } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ComposeDrawer } from "@/components/compose-drawer";
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
    .map((m) => m.from.email)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(", ");

  return (
    <article className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-textMuted hover:text-textPrimary">
        <ChevronLeft className="h-4 w-4" /> Back to inbox
      </Link>

      <header className="space-y-2">
        <h1 className="font-display text-3xl leading-tight text-textPrimary sm:text-4xl">
          {lastMessage.subject}
        </h1>
        <p className="text-sm text-textMuted">
          {thread.messages.length} message{thread.messages.length === 1 ? "" : "s"} · {uniqueFroms}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {lastMessage.labels.map((l) => (
            <span
              key={l}
              className="inline-flex items-center gap-1 rounded border border-aiAccentBorder bg-aiAccentSoft px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-aiAccent"
            >
              {l}
              <button
                onClick={() => void applyLabel(lastMessage, l, false)}
                aria-label={`Remove label ${l}`}
                className="hover:text-red-300"
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
          return (
            <motion.section
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: motionTokens.duration.base, delay: i * 0.03, ease: motionTokens.ease.out }}
              className="glass-card rounded-card p-4"
            >
              <header className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-textPrimary">{m.from.name ?? m.from.email}</span>
                <span className="font-mono text-xs text-textDim">{new Date(m.receivedAt).toLocaleString()}</span>
              </header>
              {ai && (
                <p className="mt-2 flex items-center gap-1.5 font-display text-[13px] italic text-aiAccent">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden /> {ai.summary}
                </p>
              )}
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-textPrimary/90">{m.body}</div>
            </motion.section>
          );
        })}
      </div>

      <section
        aria-labelledby="reply-heading"
        className="space-y-3 rounded-card border border-aiAccentBorder bg-aiAccentSoft p-4"
      >
        <header className="flex items-center justify-between">
          <h2
            id="reply-heading"
            className="flex items-center gap-1.5 font-display text-lg italic text-aiAccent"
          >
            <Reply className="h-4 w-4" /> Suggested reply
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
    <div className="space-y-6">
      <Skeleton className="h-8 w-32 bg-card" />
      <Skeleton className="h-32 w-full bg-card" />
      <Skeleton className="h-32 w-full bg-card opacity-60" />
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
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-dashed border-aiAccent/30 text-aiAccent/80 hover:text-aiAccent hover:border-aiAccent/60"
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

