# UA-Email · PWA / Sync Plan (Phase 2 · Plan C)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. Checkbox tracking.

**Goal:** Connect the dots. After this plan, opening the app fetches mail from every configured account, batches new messages through `/api/ai/triage`, writes triage results to IndexedDB, and the UI reactively re-renders triaged cards.

**Pragmatic scope decision:** The spec calls for a Web Worker. For v1, we use main-thread async loops driven by `requestIdleCallback` + `setInterval`. This keeps the UI thread free during idle work without the build complexity of a Web Worker entry point. **Web Worker promotion is a stretch goal documented in the writeup.**

**Tech additions:** `dexie-react-hooks` for reactive UI queries against IndexedDB.

---

## File Structure

```
src/lib/sync/
├── sync-engine.ts                ← Task 2 — orchestrator (sync one account)
├── triage-batcher.ts             ← Task 3 — batched AI calls
└── sync-loop.ts                  ← Task 4 — idle-driven periodic loop

src/hooks/
├── use-sync.ts                   ← Task 5 — React hook to bootstrap the loop
├── use-accounts.ts               ← Task 5 — Dexie reactive accounts list
└── use-triaged-inbox.ts          ← Task 6 — Dexie reactive messages by bucket

src/components/
└── triaged-inbox-view.tsx        (REPLACE — Task 7, real triage rendering)

tests/unit/
├── sync-engine.test.ts           ← Task 8
└── triage-batcher.test.ts        ← Task 8
```

---

## Task 1: Install `dexie-react-hooks`

- [ ] **Step 1.1**

```bash
pnpm add dexie-react-hooks
```

- [ ] **Step 1.2 — Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "[pwa-agent] chore(deps): dexie-react-hooks for reactive IndexedDB queries

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Sync engine — fetch + diff one account

**Files:** Create `src/lib/sync/sync-engine.ts`

- [ ] **Step 2.1**

```ts
import { getDB } from "@/lib/db/db";
import type { Account } from "@/lib/types/account";
import type { Message } from "@/lib/types/message";
import type { MessageRow } from "@/lib/db/schema";
import { makeProvider } from "@/lib/providers/factory";

export interface SyncResult {
  accountId: string;
  fetched: number;
  newMessages: Message[];   // messages we didn't have before
  errored: boolean;
  errorReason?: string;
}

/**
 * Fetch the latest page for one account, diff against IndexedDB, return the
 * new messages so the caller can ship them to the AI batcher.
 */
export async function syncAccount(account: Account, limit = 50): Promise<SyncResult> {
  const db = getDB();
  try {
    const provider = makeProvider(account);
    const { messages } = await provider.list({ limit });

    const existingIds = new Set(
      (await db.messages.where("accountId").equals(account.id).primaryKeys()) as string[],
    );

    const newMessages = messages.filter((m) => !existingIds.has(m.id));

    if (messages.length > 0) {
      const rows: MessageRow[] = messages.map((m) => ({ ...m }));
      await db.messages.bulkPut(rows);
    }

    await db.accounts.update(account.id, { lastSyncAt: Date.now() });

    return {
      accountId: account.id,
      fetched: messages.length,
      newMessages,
      errored: false,
    };
  } catch (err) {
    return {
      accountId: account.id,
      fetched: 0,
      newMessages: [],
      errored: true,
      errorReason: err instanceof Error ? err.message : "unknown",
    };
  }
}
```

- [ ] **Step 2.2 — Commit**

```bash
git add src/lib/sync/sync-engine.ts
git commit -m "[pwa-agent] feat(sync): syncAccount fetches + diffs against IndexedDB

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Triage batcher — call AI on new messages

**Files:** Create `src/lib/sync/triage-batcher.ts`

- [ ] **Step 3.1**

```ts
import { getDB } from "@/lib/db/db";
import type { Message } from "@/lib/types/message";
import type { AiResult } from "@/lib/types/ai";

const BATCH_SIZE = 20;

export interface TriageBatchOptions {
  provider?: "anthropic" | "openai" | "gemini";
  byok?: string;
}

export async function triageNewMessages(
  newMessages: Message[],
  opts: TriageBatchOptions = {},
): Promise<{ processed: number; cacheHitRate: number }> {
  if (newMessages.length === 0) return { processed: 0, cacheHitRate: 0 };

  const db = getDB();
  const batches: Message[][] = [];
  for (let i = 0; i < newMessages.length; i += BATCH_SIZE) {
    batches.push(newMessages.slice(i, i + BATCH_SIZE));
  }

  let processed = 0;
  let lastHitRate = 0;

  for (const batch of batches) {
    const payload = {
      ...(opts.provider ? { provider: opts.provider } : {}),
      ...(opts.byok ? { byok: opts.byok } : {}),
      emails: batch.map((m) => ({
        messageId: m.id,
        from: m.from.name ? `${m.from.name} <${m.from.email}>` : m.from.email,
        subject: m.subject,
        bodyExcerpt: m.body.slice(0, 4000),
        receivedAt: m.receivedAt,
      })),
    };

    const res = await fetch("/api/ai/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // Soft fail: log + continue. Messages stay unbucketed; inbox falls back
      // to chronological per spec §10 principle #5.
      console.warn("[triage-batcher] AI call failed", await res.text());
      continue;
    }

    const data = (await res.json()) as {
      results: AiResult[];
      model: string;
      promptCacheHit: boolean;
      cacheHitRate: number;
    };
    lastHitRate = data.cacheHitRate ?? 0;

    if (data.results.length > 0) {
      await db.transaction("rw", [db.aiResults, db.messages], async () => {
        await db.aiResults.bulkPut(data.results);
        // Denormalize bucket + summary onto messages for fast bucket queries
        for (const r of data.results) {
          await db.messages.update(r.messageId, {
            bucket: r.bucket,
            aiProcessedAt: r.processedAt,
            promptCacheHit: r.promptCacheHit,
          });
        }
      });
    }

    processed += data.results.length;
  }

  return { processed, cacheHitRate: lastHitRate };
}
```

- [ ] **Step 3.2 — Commit**

```bash
git add src/lib/sync/triage-batcher.ts
git commit -m "[ai-agent] feat(sync): triageNewMessages batches /api/ai/triage + writes results

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Sync loop — idle-driven, periodic

**Files:** Create `src/lib/sync/sync-loop.ts`

- [ ] **Step 4.1**

```ts
import { syncAccount } from "@/lib/sync/sync-engine";
import { triageNewMessages } from "@/lib/sync/triage-batcher";
import { listAccounts } from "@/lib/accounts/account-store";

export interface SyncLoopOptions {
  intervalSec?: number;
  provider?: "anthropic" | "openai" | "gemini";
  byok?: string;
  onTick?: (info: { processed: number; cacheHitRate: number; errors: string[] }) => void;
}

let currentTimer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

export async function runOnce(opts: SyncLoopOptions = {}): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const accounts = await listAccounts();
    let totalProcessed = 0;
    let lastHitRate = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      const result = await syncAccount(account);
      if (result.errored) {
        errors.push(`${account.email}: ${result.errorReason ?? "unknown"}`);
        continue;
      }
      if (result.newMessages.length > 0) {
        const triage = await triageNewMessages(result.newMessages, {
          ...(opts.provider ? { provider: opts.provider } : {}),
          ...(opts.byok ? { byok: opts.byok } : {}),
        });
        totalProcessed += triage.processed;
        lastHitRate = triage.cacheHitRate;
      }
    }

    opts.onTick?.({ processed: totalProcessed, cacheHitRate: lastHitRate, errors });
  } finally {
    inFlight = false;
  }
}

export function startSyncLoop(opts: SyncLoopOptions = {}): () => void {
  stopSyncLoop();
  const intervalMs = (opts.intervalSec ?? 60) * 1000;

  // Run once immediately, then on interval
  void runOnce(opts);
  currentTimer = setInterval(() => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => void runOnce(opts));
    } else {
      void runOnce(opts);
    }
  }, intervalMs);

  return stopSyncLoop;
}

export function stopSyncLoop(): void {
  if (currentTimer) {
    clearInterval(currentTimer);
    currentTimer = null;
  }
}
```

- [ ] **Step 4.2 — Commit**

```bash
git add src/lib/sync/sync-loop.ts
git commit -m "[pwa-agent] feat(sync): idle-driven sync loop (requestIdleCallback)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: React hooks — `useSync`, `useAccounts`

**Files:** Create `src/hooks/use-sync.ts`, `src/hooks/use-accounts.ts`

- [ ] **Step 5.1 — `use-accounts.ts`**

```ts
"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/db/db";
import type { Account } from "@/lib/types/account";

export function useAccounts(): Account[] | undefined {
  return useLiveQuery(async () => {
    if (typeof indexedDB === "undefined") return [];
    return getDB().accounts.toArray();
  }, []);
}
```

- [ ] **Step 5.2 — `use-sync.ts`**

```ts
"use client";
import { useEffect, useState } from "react";
import { startSyncLoop } from "@/lib/sync/sync-loop";

interface TickInfo { processed: number; cacheHitRate: number; errors: string[]; lastAt: number }

export function useSync(opts: { intervalSec?: number } = {}): TickInfo | null {
  const [info, setInfo] = useState<TickInfo | null>(null);

  useEffect(() => {
    if (typeof indexedDB === "undefined") return;
    const stop = startSyncLoop({
      ...(opts.intervalSec ? { intervalSec: opts.intervalSec } : {}),
      onTick: (t) => setInfo({ ...t, lastAt: Date.now() }),
    });

    // Re-sync on tab focus
    const onFocus = () => { if (document.visibilityState === "visible") void import("@/lib/sync/sync-loop").then(m => m.runOnce()); };
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [opts.intervalSec]);

  return info;
}
```

- [ ] **Step 5.3 — Commit**

```bash
git add src/hooks
git commit -m "[ui-agent] feat(hooks): useSync (bootstrap sync loop) + useAccounts (live Dexie)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `useTriagedInbox` hook

**Files:** Create `src/hooks/use-triaged-inbox.ts`

- [ ] **Step 6.1**

```ts
"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/db/db";
import type { Bucket } from "@/lib/types/message";
import type { MessageRow } from "@/lib/db/schema";

export interface TriagedBucket {
  bucket: Bucket | "unclassified";
  messages: MessageRow[];
}

const BUCKET_ORDER: (Bucket | "unclassified")[] = [
  "needs_reply",
  "fyi",
  "newsletter",
  "noise",
  "unclassified",
];

export function useTriagedInbox(activeAccountId?: string | "unified"): TriagedBucket[] | undefined {
  return useLiveQuery(async () => {
    if (typeof indexedDB === "undefined") return BUCKET_ORDER.map(b => ({ bucket: b, messages: [] }));

    const db = getDB();
    let all: MessageRow[];

    if (!activeAccountId || activeAccountId === "unified") {
      all = await db.messages.orderBy("receivedAt").reverse().toArray();
    } else {
      all = await db.messages
        .where("[accountId+receivedAt]")
        .between([activeAccountId, 0], [activeAccountId, Number.MAX_SAFE_INTEGER])
        .reverse()
        .toArray();
    }

    const grouped: Record<string, MessageRow[]> = {
      needs_reply: [],
      fyi: [],
      newsletter: [],
      noise: [],
      unclassified: [],
    };
    for (const m of all) {
      const key = m.bucket ?? "unclassified";
      grouped[key]?.push(m);
    }

    return BUCKET_ORDER.map(b => ({ bucket: b, messages: grouped[b] ?? [] }));
  }, [activeAccountId]);
}
```

- [ ] **Step 6.2 — Commit**

```bash
git add src/hooks/use-triaged-inbox.ts
git commit -m "[ui-agent] feat(hooks): useTriagedInbox - reactive bucketed messages

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Replace `TriagedInboxView` with real-data version

**Files:** Replace `src/components/triaged-inbox-view.tsx`

- [ ] **Step 7.1**

```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Inbox as InboxIcon, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion as motionTokens } from "@/styles/motion-tokens";
import { useSync } from "@/hooks/use-sync";
import { useTriagedInbox } from "@/hooks/use-triaged-inbox";
import { useAccounts } from "@/hooks/use-accounts";
import type { MessageRow } from "@/lib/db/schema";
import type { Bucket } from "@/lib/types/message";

const BUCKET_META: Record<Bucket | "unclassified", { label: string; color: string; tag: string }> = {
  needs_reply: { label: "Needs reply", color: "text-bucket-needsReply", tag: "needsReply" },
  fyi:         { label: "FYI", color: "text-bucket-fyi", tag: "fyi" },
  newsletter:  { label: "Newsletters", color: "text-bucket-newsletter", tag: "newsletter" },
  noise:       { label: "Noise", color: "text-bucket-noise", tag: "noise" },
  unclassified:{ label: "Unclassified", color: "text-textMuted", tag: "muted" },
};

export function TriagedInboxView({ activeAccountId }: { activeAccountId?: string | "unified" }) {
  const accounts = useAccounts();
  const triaged = useTriagedInbox(activeAccountId);
  const sync = useSync({ intervalSec: 60 });

  const noAccounts = (accounts?.length ?? 0) === 0;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-textPrimary">Your inbox, triaged</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-textMuted">
            <Sparkles className={cn("h-3.5 w-3.5 text-aiAccent", sync && sync.processed > 0 && "animate-pulse")} aria-hidden />
            <span>
              {noAccounts
                ? "Add an account to begin."
                : sync
                  ? `Triaged ${sync.processed} new · cache hit ${(sync.cacheHitRate * 100).toFixed(0)}%`
                  : "Syncing…"}
            </span>
          </p>
        </div>
      </header>

      {sync?.errors.length ? (
        <div className="flex items-start gap-2 rounded-card border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300" role="alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Sync had {sync.errors.length} issue{sync.errors.length === 1 ? "" : "s"}.</div>
            <ul className="mt-1 text-xs text-red-300/80">
              {sync.errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="space-y-6">
        {triaged?.map((b, i) => {
          const meta = BUCKET_META[b.bucket];
          if (b.bucket === "unclassified" && b.messages.length === 0) return null;

          return (
            <motion.section
              key={b.bucket}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: motionTokens.duration.base, delay: i * 0.04, ease: motionTokens.ease.out }}
              aria-labelledby={`bucket-${b.bucket}`}
            >
              <div className="mb-2 flex items-baseline justify-between">
                <h2 id={`bucket-${b.bucket}`} className={cn("text-xs uppercase tracking-[2px]", meta.color)}>
                  — {meta.label}
                </h2>
                <span className="text-xs text-textDim">{b.messages.length}</span>
              </div>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {b.messages.slice(0, 10).map((m) => (
                    <motion.article
                      key={m.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={motionTokens.springReflow}
                      className="rounded-card border border-cardBorder bg-card backdrop-blur-card p-4"
                      aria-label={`${meta.label}: ${m.subject} from ${m.from.email}`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium text-sm text-textPrimary truncate">{m.from.name ?? m.from.email}</span>
                        <span className="text-xs text-textDim font-mono">{formatTime(m.receivedAt)}</span>
                      </div>
                      <h3 className="mt-1 text-base font-medium text-textPrimary leading-tight">{m.subject}</h3>
                      {m.bucket && (
                        <p className="mt-2 text-sm text-textMuted italic flex items-start gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-aiAccent mt-0.5 flex-shrink-0" aria-hidden />
                          <span>{m.snippet || "(no summary yet)"}</span>
                        </p>
                      )}
                    </motion.article>
                  ))}
                </AnimatePresence>
                {b.messages.length === 0 && (
                  <p className="text-sm text-textMuted italic">Nothing in this bucket yet.</p>
                )}
              </div>
            </motion.section>
          );
        }) ?? (
          <>
            <Skeleton className="h-20 w-full rounded-card bg-card" />
            <Skeleton className="h-20 w-full rounded-card bg-card opacity-60" />
          </>
        )}
      </div>

      {noAccounts && (
        <div className="rounded-card border border-cardBorder bg-card p-6 text-center" role="status">
          <InboxIcon className="h-8 w-8 text-aiAccent mx-auto mb-2" aria-hidden />
          <p className="text-sm text-textMuted">
            No accounts yet — click <strong>Unified Inbox</strong> in the header, then <strong>Add account</strong>.
          </p>
        </div>
      )}
    </div>
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

- [ ] **Step 7.2 — Update `page.tsx` to track activeAccountId state**

Replace `src/app/page.tsx` (the OAuth callback effect stays):

```tsx
"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AccountSwitcher } from "@/components/account-switcher";
import { TriagedInboxView } from "@/components/triaged-inbox-view";
import { addAccount } from "@/lib/accounts/account-store";
import { toast } from "sonner";

export default function HomePage() {
  const [activeAccountId, setActiveAccountId] = useState<string | "unified">("unified");

  return (
    <main className="space-y-8">
      <Suspense fallback={null}><AuthCallback /></Suspense>
      <div className="flex items-center justify-between">
        <AccountSwitcher activeAccountId={activeAccountId} onChange={setActiveAccountId} />
      </div>
      <TriagedInboxView activeAccountId={activeAccountId} />
    </main>
  );
}

function AuthCallback() {
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("auth") !== "callback") return;
    (async () => {
      try {
        const res = await fetch("/api/auth/handoff", { method: "POST" });
        if (!res.ok) return;
        const t = await res.json();
        if (!t.accessToken) { toast.error("Token handoff returned no access token"); return; }
        await addAccount({
          id: crypto.randomUUID(),
          provider: t.provider === "google" ? "gmail" : "outlook",
          email: t.email,
          label: t.email,
          oauthTokens: {
            accessToken: t.accessToken,
            refreshToken: t.refreshToken,
            expiresAt: t.expiresAt,
            scope: t.scope ?? "",
          },
          lastSyncAt: null,
        });
        toast.success(`Connected ${t.email}`);
        history.replaceState(null, "", "/");
      } catch (e) {
        toast.error("Handoff failed: " + (e instanceof Error ? e.message : "unknown"));
      }
    })();
  }, [params]);
  return null;
}
```

- [ ] **Step 7.3 — Verify build + e2e (the no-accounts empty state should still pass the bucket-headings e2e test)**

```bash
pnpm exec tsc --noEmit && pnpm build && pnpm test:e2e --project=chromium
```

- [ ] **Step 7.4 — Commit**

```bash
git add src/components/triaged-inbox-view.tsx src/app/page.tsx
git commit -m "[ui-agent] feat(home): real triaged-inbox rendering against Dexie + auto-sync

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Tests for sync engine + triage batcher

**Files:** Create `tests/unit/sync-engine.test.ts`, `tests/unit/triage-batcher.test.ts`

- [ ] **Step 8.1 — `sync-engine.test.ts`**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";
import { syncAccount } from "@/lib/sync/sync-engine";
import { getDB } from "@/lib/db/db";
import type { Account } from "@/lib/types/account";

const imapAccount: Account = {
  id: "acct-sync-1",
  provider: "imap",
  email: "demo@example.com",
  label: "Demo",
  imapCreds: { host: "imap.example.com", port: 993, secure: true, user: "demo", pass: "p" },
  lastSyncAt: null,
};

describe("syncAccount", () => {
  beforeEach(async () => {
    const db = getDB();
    await db.delete();
    await db.open();
    await db.accounts.put(imapAccount);
    server.resetHandlers();
  });

  it("fetches new messages and writes them to IndexedDB", async () => {
    server.use(
      http.post("/api/imap", () =>
        HttpResponse.json({
          messages: [
            {
              uid: 1, messageId: "<m1>", threadId: "<m1>",
              from: { email: "a@b.com" }, to: [{ email: "demo@example.com" }], cc: [],
              subject: "First", snippet: "snip1", body: "body1",
              receivedAt: 1_700_000_000_000, flags: { unread: true, flagged: false }, labels: [],
            },
          ],
        })),
    );

    const result = await syncAccount(imapAccount);
    expect(result.errored).toBe(false);
    expect(result.fetched).toBe(1);
    expect(result.newMessages).toHaveLength(1);

    const stored = await getDB().messages.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.subject).toBe("First");
  });

  it("only returns truly new messages on second sync", async () => {
    server.use(
      http.post("/api/imap", () =>
        HttpResponse.json({
          messages: [
            { uid: 1, messageId: "<m1>", threadId: "<m1>",
              from: { email: "a@b.com" }, to: [{ email: "demo@example.com" }], cc: [],
              subject: "First", snippet: "", body: "", receivedAt: 1_700_000_000_000,
              flags: { unread: true, flagged: false }, labels: [] },
          ],
        })),
    );

    await syncAccount(imapAccount);
    const second = await syncAccount(imapAccount);
    expect(second.fetched).toBe(1);
    expect(second.newMessages).toHaveLength(0); // not new anymore
  });

  it("reports errored=true on provider failure", async () => {
    server.use(
      http.post("/api/imap", () =>
        HttpResponse.json({ error: "imap_error", message: "auth failed" }, { status: 401 })),
    );

    const result = await syncAccount(imapAccount);
    expect(result.errored).toBe(true);
    expect(result.errorReason).toContain("auth");
  });
});
```

- [ ] **Step 8.2 — `triage-batcher.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";
import { triageNewMessages } from "@/lib/sync/triage-batcher";
import { getDB } from "@/lib/db/db";
import type { Message } from "@/lib/types/message";

function fakeMessage(id: string): Message {
  return {
    id, accountId: "acct-1", threadId: "t-" + id,
    from: { email: "a@b.com" }, to: [{ email: "me@me.com" }], cc: [], bcc: [],
    subject: "Subject " + id, snippet: "", body: "body " + id,
    receivedAt: 1_700_000_000_000, labels: [],
    flags: { unread: true, starred: false, archived: false, trashed: false },
  };
}

describe("triageNewMessages", () => {
  beforeEach(async () => {
    const db = getDB();
    await db.delete();
    await db.open();
    server.resetHandlers();
  });

  it("calls /api/ai/triage and writes aiResults + denormalizes bucket onto messages", async () => {
    const db = getDB();
    const msgs = [fakeMessage("m-1"), fakeMessage("m-2")];
    await db.messages.bulkPut(msgs);

    server.use(
      http.post("/api/ai/triage", async ({ request }) => {
        const body = (await request.json()) as { emails: { messageId: string }[] };
        return HttpResponse.json({
          results: body.emails.map(e => ({
            messageId: e.messageId,
            bucket: "needs_reply",
            summary: "summary " + e.messageId,
            suggestedReply: "reply " + e.messageId,
            model: "claude-test",
            processedAt: 1_700_000_000_000,
            promptCacheHit: true,
            version: 1,
          })),
          model: "claude-test",
          promptCacheHit: true,
          cacheHitRate: 0.5,
        });
      }),
    );

    const out = await triageNewMessages(msgs);
    expect(out.processed).toBe(2);
    expect(out.cacheHitRate).toBe(0.5);

    const results = await db.aiResults.toArray();
    expect(results).toHaveLength(2);
    expect(results[0]?.bucket).toBe("needs_reply");

    const denorm = await db.messages.get("m-1");
    expect(denorm?.bucket).toBe("needs_reply");
    expect(denorm?.promptCacheHit).toBe(true);
  });

  it("returns 0 processed when there are no messages", async () => {
    const out = await triageNewMessages([]);
    expect(out.processed).toBe(0);
  });

  it("does not throw when AI call fails (soft fallback)", async () => {
    server.use(
      http.post("/api/ai/triage", () =>
        HttpResponse.json({ error: "rate_limit" }, { status: 429 })),
    );
    await expect(triageNewMessages([fakeMessage("m-1")])).resolves.toMatchObject({ processed: 0 });
  });
});
```

- [ ] **Step 8.3 — Run tests + commit**

```bash
pnpm test:unit
git add tests/unit/sync-engine.test.ts tests/unit/triage-batcher.test.ts
git commit -m "[test-agent] test(sync): syncAccount + triageNewMessages with MSW

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

Expected: **16 + 6 = 22** unit tests passing.

---

## Task 9: Final gauntlet

```bash
pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build && pnpm test:e2e --project=chromium
```

If anything broke, fix under `[infra-agent]` and commit.

---

## Self-Review

- §9 Sync engine — ✓ Tasks 2-4 (idle-driven, document.visibilitychange, idempotent against IndexedDB diff).
- §10 Failure modes — ✓ `syncAccount` returns `errored=true` cleanly; `triageNewMessages` soft-fallback on AI failure.
- §2 Principle #5 (usable when AI fails) — ✓ messages still get fetched and stored even if triage fails.

## Execution Handoff

Subagent-driven execution.
