# UA-Email · UI Screens Plan (Phase 2 · Plan D)

> Subagent-driven execution.

**Goal:** Round out the consumer surface — thread view, compose/reply, archive/delete actions, search, and settings. After this plan, the app is feature-complete vs. the spec.

---

## File Structure

```
src/app/
├── thread/[threadId]/page.tsx        ← Task 2
└── settings/page.tsx                  ← Task 7

src/components/
├── thread-view.tsx                    ← Task 2
├── compose-drawer.tsx                 ← Task 3
├── search-bar.tsx                     ← Task 6
└── triage-card.tsx                    ← Task 1 (extracted from triaged-inbox-view)

src/hooks/
├── use-thread.ts                      ← Task 2
└── use-settings.ts                    ← Task 7

src/lib/actions/
└── message-actions.ts                 ← Task 4 (archive/delete/setLabel via provider)
```

---

## Task 1: Extract `TriageCard` component + add swipe-to-archive

**Files:** Create `src/components/triage-card.tsx`, modify `triaged-inbox-view.tsx` to use it

- [ ] **Step 1.1 — `triage-card.tsx`**

```tsx
"use client";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Sparkles, Archive, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion as motionTokens } from "@/styles/motion-tokens";
import type { MessageRow } from "@/lib/db/schema";
import { archiveMessage, deleteMessage } from "@/lib/actions/message-actions";
import { toast } from "sonner";

interface Props { message: MessageRow }

export function TriageCard({ message }: Props) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-150, 0, 150], [0.4, 1, 0.4]);
  const [pending, setPending] = useState<"archive" | "delete" | null>(null);

  async function handleArchive() {
    setPending("archive");
    try { await archiveMessage(message); toast.success("Archived"); }
    catch (e) { toast.error("Archive failed: " + (e instanceof Error ? e.message : "unknown")); setPending(null); }
  }

  async function handleDelete() {
    setPending("delete");
    try { await deleteMessage(message); toast.success("Deleted"); }
    catch (e) { toast.error("Delete failed: " + (e instanceof Error ? e.message : "unknown")); setPending(null); }
  }

  return (
    <motion.div
      layout
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      style={{ x, opacity }}
      onDragEnd={(_, info) => {
        if (info.offset.x < -120) handleArchive();
        else if (info.offset.x > 120) handleDelete();
      }}
      transition={motionTokens.springReflow}
      className="relative"
    >
      <Link
        href={`/thread/${encodeURIComponent(message.threadId)}`}
        className={cn(
          "block rounded-card border border-cardBorder bg-card backdrop-blur-card p-4 transition-colors hover:border-aiAccent/40",
          pending && "opacity-50 pointer-events-none",
        )}
        aria-label={`${message.bucket ?? "unclassified"}: ${message.subject} from ${message.from.email}`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className={cn("font-medium text-sm truncate", message.flags.unread ? "text-textPrimary" : "text-textMuted")}>
            {message.from.name ?? message.from.email}
          </span>
          <span className="text-xs text-textDim font-mono">{formatTime(message.receivedAt)}</span>
        </div>
        <h3 className={cn("mt-1 text-base leading-tight", message.flags.unread ? "font-semibold text-textPrimary" : "text-textMuted")}>
          {message.subject}
        </h3>
        {message.bucket && (
          <p className="mt-2 text-sm text-textMuted italic flex items-start gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-aiAccent mt-0.5 flex-shrink-0" aria-hidden />
            <span>{message.snippet || "(no summary yet)"}</span>
          </p>
        )}
      </Link>

      {pending === "archive" && (
        <div className="absolute inset-0 flex items-center justify-end pr-6 pointer-events-none">
          <Archive className="h-5 w-5 text-aiAccent" />
        </div>
      )}
      {pending === "delete" && (
        <div className="absolute inset-0 flex items-center justify-start pl-6 pointer-events-none">
          <Trash2 className="h-5 w-5 text-red-400" />
        </div>
      )}
    </motion.div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
```

- [ ] **Step 1.2 — Update `triaged-inbox-view.tsx` to use `<TriageCard>`**

Replace the inline `<motion.article>` block with `<TriageCard key={m.id} message={m} />`. Remove the now-unused `formatTime` helper from `triaged-inbox-view.tsx`. Remove unused `AnimatePresence` import if no longer needed (keep it — used by parent for layout transitions).

- [ ] **Step 1.3 — Commit**

```bash
git add src/components/triage-card.tsx src/components/triaged-inbox-view.tsx
git commit -m "[ui-agent] feat(inbox): TriageCard with swipe-to-archive + link to thread

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Thread view page

**Files:** Create `src/app/thread/[threadId]/page.tsx`, `src/components/thread-view.tsx`, `src/hooks/use-thread.ts`

- [ ] **Step 2.1 — `use-thread.ts`**

```ts
"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/db/db";
import type { MessageRow } from "@/lib/db/schema";
import type { AiResult } from "@/lib/types/ai";

export function useThread(threadId: string): { messages: MessageRow[]; aiByMessage: Record<string, AiResult> } | undefined {
  return useLiveQuery(async () => {
    if (typeof indexedDB === "undefined") return { messages: [], aiByMessage: {} };
    const db = getDB();
    const messages = await db.messages.where("threadId").equals(threadId).sortBy("receivedAt");
    const aiResults = await db.aiResults.where("messageId").anyOf(messages.map(m => m.id)).toArray();
    const aiByMessage: Record<string, AiResult> = {};
    for (const r of aiResults) aiByMessage[r.messageId] = r;
    return { messages, aiByMessage };
  }, [threadId]);
}
```

- [ ] **Step 2.2 — `thread-view.tsx`**

```tsx
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
  const suggestedReply = lastAi?.suggestedReply;

  async function regenerate() {
    setDrafting(true);
    try {
      const threadPlaintext = thread!.messages.map(m =>
        `From: ${m.from.name ?? m.from.email}\nSubject: ${m.subject}\n\n${m.body}`
      ).join("\n\n---\n\n");
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: { id: lastMessage.id, threadId: lastMessage.threadId, subject: lastMessage.subject, body: lastMessage.body },
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
      // Toast handled inside sendReply
    } finally {
      setSending(false);
    }
  }

  return (
    <article className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-textMuted hover:text-textPrimary">
        <ChevronLeft className="h-4 w-4" /> Back to inbox
      </Link>

      <header>
        <h1 className="font-display text-2xl text-textPrimary">{lastMessage.subject}</h1>
        <p className="mt-1 text-sm text-textDim">{thread.messages.length} message{thread.messages.length === 1 ? "" : "s"} · {thread.messages.map(m => m.from.email).filter((v, i, a) => a.indexOf(v) === i).join(", ")}</p>
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
          <Button variant="ghost" size="sm" onClick={regenerate} disabled={drafting}>
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
          <Button onClick={send} disabled={sending || (!draft && !suggestedReply)}>
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
```

- [ ] **Step 2.3 — `thread/[threadId]/page.tsx`**

```tsx
import { ThreadView } from "@/components/thread-view";

export default async function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  return <ThreadView threadId={decodeURIComponent(threadId)} />;
}
```

- [ ] **Step 2.4 — Commit**

```bash
git add src/app/thread src/components/thread-view.tsx src/hooks/use-thread.ts
git commit -m "[ui-agent] feat(thread): thread view with AI summary + editable suggested reply

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Message actions (archive, delete, send reply)

**Files:** Create `src/lib/actions/message-actions.ts`

- [ ] **Step 3.1**

```ts
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
  await provider.send({
    to: [replyingTo.from],
    subject,
    body,
    inReplyToMessageId: replyingTo.id,
  });
  toast.success("Reply sent");
}
```

- [ ] **Step 3.2 — Commit**

```bash
git add src/lib/actions/message-actions.ts
git commit -m "[ui-agent] feat(actions): archive/delete/sendReply via MailProvider

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Compose drawer (new message + reply)

**Files:** Create `src/components/compose-drawer.tsx`

- [ ] **Step 4.1**

```tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccounts } from "@/hooks/use-accounts";
import { makeProvider } from "@/lib/providers/factory";
import { toast } from "sonner";

interface Props { open: boolean; onOpenChange: (o: boolean) => void }

export function ComposeDrawer({ open, onOpenChange }: Props) {
  const accounts = useAccounts();
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    const acct = accounts?.find(a => a.id === from);
    if (!acct) { toast.error("Select an account"); return; }
    setSending(true);
    try {
      const provider = makeProvider(acct);
      await provider.send({
        to: to.split(",").map(s => s.trim()).filter(Boolean).map(email => ({ email })),
        subject, body,
      });
      toast.success("Sent");
      setTo(""); setSubject(""); setBody("");
      onOpenChange(false);
    } catch (e) {
      toast.error("Send failed: " + (e instanceof Error ? e.message : "unknown"));
    } finally {
      setSending(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="bg-canvas border border-cardBorder rounded-t-drawer sm:rounded-drawer w-full sm:max-w-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="compose-title"
          >
            <header className="flex items-center justify-between">
              <h2 id="compose-title" className="font-display text-xl text-textPrimary">New message</h2>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close compose"><X className="h-4 w-4" /></Button>
            </header>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="from">From</Label>
                <select
                  id="from"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full bg-card border border-cardBorder rounded-card px-3 py-2 text-sm text-textPrimary"
                >
                  <option value="">Select an account…</option>
                  {accounts?.map(a => <option key={a.id} value={a.id}>{a.email}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to">To</Label>
                <Input id="to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="someone@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="body">Body</Label>
                <textarea
                  id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={8}
                  className="w-full bg-card border border-cardBorder rounded-card p-3 text-sm text-textPrimary placeholder:text-textDim resize-none focus:outline-none focus:border-aiAccent/60"
                  placeholder="Write your message…"
                />
              </div>
            </div>

            <footer className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
              <Button onClick={handleSend} disabled={sending || !from || !to || !subject}>
                {sending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Sending…</> : <><Send className="h-4 w-4 mr-1.5" />Send</>}
              </Button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 4.2 — Wire compose button into the home page**

In `src/app/page.tsx`, add a "Compose" button next to AccountSwitcher that opens `<ComposeDrawer>`:

```tsx
// Add to imports:
import { useState } from "react"; // already there
import { ComposeDrawer } from "@/components/compose-drawer";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

// In HomePage(), after activeAccountId state, add:
const [composeOpen, setComposeOpen] = useState(false);

// In the JSX, replace the AccountSwitcher block with:
<div className="flex items-center justify-between">
  <AccountSwitcher activeAccountId={activeAccountId} onChange={setActiveAccountId} />
  <Button onClick={() => setComposeOpen(true)} size="sm"><Pencil className="h-3.5 w-3.5 mr-1.5" />Compose</Button>
</div>
<ComposeDrawer open={composeOpen} onOpenChange={setComposeOpen} />
```

- [ ] **Step 4.3 — Commit**

```bash
git add src/components/compose-drawer.tsx src/app/page.tsx
git commit -m "[ui-agent] feat(compose): ComposeDrawer (mobile-native bottom sheet) + home wire-up

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Search bar (client-side filter on cached messages)

**Files:** Create `src/components/search-bar.tsx`, modify `triaged-inbox-view.tsx` to filter when search is active

- [ ] **Step 5.1 — `search-bar.tsx`**

```tsx
"use client";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props { value: string; onChange: (v: string) => void }

export function SearchBar({ value, onChange }: Props) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textDim" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search inbox…  e.g. bucket:needs_reply from:sarah"
        className="pl-9 pr-9 bg-card border-cardBorder"
        aria-label="Search messages"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChange("")}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 5.2 — Update `triaged-inbox-view.tsx` to accept + apply search**

Add a `searchQuery` prop to `TriagedInboxView`. After `useTriagedInbox(...)`, apply filter when `searchQuery` non-empty:

```tsx
// Add to top of component:
const filtered = (() => {
  if (!triaged || !searchQuery.trim()) return triaged;
  const q = searchQuery.toLowerCase();
  const bucketMatch = q.match(/bucket:(\S+)/);
  const fromMatch = q.match(/from:(\S+)/);
  const textQ = q.replace(/bucket:\S+/g, "").replace(/from:\S+/g, "").trim();
  return triaged.map(b => ({
    bucket: b.bucket,
    messages: b.messages.filter(m =>
      (!bucketMatch || m.bucket === bucketMatch[1]) &&
      (!fromMatch || m.from.email.toLowerCase().includes(fromMatch[1]!)) &&
      (!textQ || m.subject.toLowerCase().includes(textQ) || m.snippet.toLowerCase().includes(textQ) || m.body.toLowerCase().includes(textQ))
    ),
  }));
})();
// Then use `filtered?.map(...)` instead of `triaged?.map(...)`.
```

Update the function signature:

```tsx
export function TriagedInboxView({ activeAccountId, searchQuery = "" }: { activeAccountId?: string | "unified"; searchQuery?: string }) {
```

- [ ] **Step 5.3 — Wire search into `page.tsx`**

```tsx
// Add state:
const [searchQuery, setSearchQuery] = useState("");

// In JSX, between AccountSwitcher row and TriagedInboxView:
<SearchBar value={searchQuery} onChange={setSearchQuery} />

// Pass to TriagedInboxView:
<TriagedInboxView activeAccountId={activeAccountId} searchQuery={searchQuery} />
```

- [ ] **Step 5.4 — Commit**

```bash
git add src/components/search-bar.tsx src/components/triaged-inbox-view.tsx src/app/page.tsx
git commit -m "[ui-agent] feat(search): search bar with bucket: and from: operators (client-side)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Settings page (LLM provider + BYOK + sync interval)

**Files:** Create `src/app/settings/page.tsx`, `src/hooks/use-settings.ts`

- [ ] **Step 6.1 — `use-settings.ts`**

```ts
"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/db/db";
import type { AppSettings } from "@/lib/db/schema";

const DEFAULTS: AppSettings = {
  id: "singleton",
  llmProvider: "anthropic",
  byok: {},
  syncIntervalSec: 60,
  hardenedMode: false,
};

export function useSettings(): { settings: AppSettings; update: (patch: Partial<AppSettings>) => Promise<void> } {
  const current = useLiveQuery(async () => {
    if (typeof indexedDB === "undefined") return DEFAULTS;
    const db = getDB();
    const existing = await db.settings.get("singleton");
    if (!existing) await db.settings.put(DEFAULTS);
    return existing ?? DEFAULTS;
  }, []);

  async function update(patch: Partial<AppSettings>) {
    const db = getDB();
    const cur = (await db.settings.get("singleton")) ?? DEFAULTS;
    await db.settings.put({ ...cur, ...patch, id: "singleton" });
  }

  return { settings: current ?? DEFAULTS, update };
}
```

- [ ] **Step 6.2 — `settings/page.tsx`**

```tsx
"use client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSettings } from "@/hooks/use-settings";
import { useAccounts } from "@/hooks/use-accounts";
import { removeAccount } from "@/lib/accounts/account-store";
import { toast } from "sonner";

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const accounts = useAccounts();

  return (
    <div className="space-y-8 max-w-2xl">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-textMuted hover:text-textPrimary">
        <ChevronLeft className="h-4 w-4" /> Back to inbox
      </Link>

      <h1 className="font-display text-3xl text-textPrimary">Settings</h1>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[2px] text-aiAccent">— AI provider</h2>
        <div className="space-y-2">
          <Label htmlFor="llmProvider">Default LLM</Label>
          <select
            id="llmProvider"
            value={settings.llmProvider}
            onChange={(e) => void update({ llmProvider: e.target.value as AppSettingsProvider })}
            className="w-full bg-card border border-cardBorder rounded-card px-3 py-2 text-sm text-textPrimary"
          >
            <option value="anthropic">Anthropic Claude (default — with prompt caching)</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Google Gemini</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="anthropic-byok">Anthropic API key (optional — BYOK)</Label>
          <Input id="anthropic-byok" type="password" placeholder="sk-ant-..." value={settings.byok.anthropic ?? ""} onChange={(e) => void update({ byok: { ...settings.byok, anthropic: e.target.value } })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="openai-byok">OpenAI API key (BYOK)</Label>
          <Input id="openai-byok" type="password" placeholder="sk-..." value={settings.byok.openai ?? ""} onChange={(e) => void update({ byok: { ...settings.byok, openai: e.target.value } })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gemini-byok">Gemini API key (BYOK)</Label>
          <Input id="gemini-byok" type="password" value={settings.byok.gemini ?? ""} onChange={(e) => void update({ byok: { ...settings.byok, gemini: e.target.value } })} />
        </div>
        <p className="text-xs text-textMuted italic">Keys stay in your browser. Sent to /api/ai/* on each request, never persisted server-side.</p>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[2px] text-aiAccent">— Sync</h2>
        <div className="space-y-2">
          <Label htmlFor="sync-interval">Sync interval (seconds)</Label>
          <Input id="sync-interval" type="number" min={15} max={3600} value={settings.syncIntervalSec} onChange={(e) => void update({ syncIntervalSec: Math.max(15, Math.min(3600, Number(e.target.value))) })} />
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[2px] text-aiAccent">— Accounts</h2>
        {!accounts?.length && <p className="text-sm text-textMuted">No accounts yet.</p>}
        {accounts?.map(a => (
          <div key={a.id} className="flex items-center justify-between rounded-card border border-cardBorder bg-card p-3">
            <div>
              <div className="text-sm text-textPrimary">{a.label}</div>
              <div className="text-xs text-textMuted">{a.email} · {a.provider}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (!confirm(`Remove ${a.email}? All its cached messages will be deleted from this device.`)) return;
                await removeAccount(a.id);
                toast.success("Account removed");
              }}
              className="text-red-400 hover:text-red-300"
            >
              Remove
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}

type AppSettingsProvider = "anthropic" | "openai" | "gemini";
```

- [ ] **Step 6.3 — Add Settings link to home page header**

In `page.tsx`, next to Compose button:

```tsx
<Button variant="ghost" size="sm" asChild>
  <Link href="/settings"><Settings className="h-3.5 w-3.5" /></Link>
</Button>
```

(Import `Link` from `next/link` and `Settings` from `lucide-react` at top.)

- [ ] **Step 6.4 — Commit**

```bash
git add src/app/settings src/hooks/use-settings.ts src/app/page.tsx
git commit -m "[ui-agent] feat(settings): LLM provider picker + BYOK + sync interval + account list

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: E2E test — navigation + compose drawer + settings link

**Files:** Create `tests/e2e/navigation.spec.ts`

- [ ] **Step 7.1**

```ts
import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("compose button opens drawer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Compose/i }).click();
    await expect(page.getByRole("dialog", { name: /New message/i })).toBeVisible();
    await expect(page.getByLabel(/To/i)).toBeVisible();
    await expect(page.getByLabel(/Subject/i)).toBeVisible();
  });

  test("settings link navigates to settings page", async ({ page }) => {
    await page.goto("/");
    await page.locator('a[href="/settings"]').click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole("heading", { name: /Settings/i, level: 1 })).toBeVisible();
    await expect(page.getByText(/Default LLM/i)).toBeVisible();
  });

  test("search bar accepts input", async ({ page }) => {
    await page.goto("/");
    const input = page.getByLabel(/Search messages/i);
    await input.fill("bucket:needs_reply");
    await expect(input).toHaveValue("bucket:needs_reply");
  });
});
```

- [ ] **Step 7.2 — Run + commit**

```bash
pnpm test:e2e --project=chromium
git add tests/e2e/navigation.spec.ts
git commit -m "[test-agent] test(e2e): compose drawer + settings link + search input

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

Expected: **5 + 3 = 8** e2e tests passing.

---

## Task 8: Gauntlet

```bash
pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build && pnpm test:e2e --project=chromium
```

Fix anything broken under `[infra-agent]`.

---

## Self-Review

- §7.1 Triaged Inbox (cards w/ swipe + suggested reply chip) — ✓ Task 1.
- §7.2 Thread view — ✓ Task 2.
- §7.3 Compose drawer — ✓ Task 4.
- §7.4 Search — ✓ Task 5 (client-side; server-side provider search remains as fallback in MailProvider.search).
- §7.5 Settings — ✓ Task 6.
- §6.2 Reply draft regeneration — ✓ Task 2 (regenerate button → /api/ai/draft).
- §10 failure modes — handled via toast on every action.
