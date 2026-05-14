# UA-Email — Universal AI-First Email Client · Design Spec

| | |
|---|---|
| **Status** | Approved — ready for implementation planning |
| **Author** | Shakul Mittal |
| **Date** | 2026-05-14 |
| **Topic slug** | `ua-email` |
| **Next step** | Hand to `superpowers:writing-plans` |

---

## 1 · Product summary

UA-Email is an **AI-first, mobile-ready Progressive Web App** that unifies a user's email across Gmail, Office 365, and any IMAP-capable provider (Yahoo, AOL, Gmail/Outlook via app password) into a single inbox.

The differentiator is not the inbox itself but the **triaged home screen**: on every sync the app calls a single LLM batch which classifies new mail into `Needs reply / FYI / Newsletters / Noise`, writes a one-line summary per email, and pre-drafts a suggested reply where applicable. The user opens the app and sees their chaos sorted in seconds — without typing or clicking.

Email content **never persists server-side**. The entire data store lives in the user's browser (IndexedDB). The Vercel backend is three stateless proxies — OAuth callback, IMAP relay, AI relay — and nothing else.

### 1.1 Audience

This is a portfolio / recruitment artifact. The primary audience is the hiring panel doing live judging on the public Vercel URL. The product principles, architecture choices, and evidence package are tuned for this audience while remaining honest engineering decisions a real product would make.

### 1.2 Non-goals (explicit)

The following are **out of scope** and stay out:

- Calendar, contacts, tasks, notes — the brief explicitly excludes these.
- Real-time push notifications (VAPID + service-worker push). Stretch goal only.
- Conversational chat sidebar ("ask your inbox"). Stretch goal — does not ship in v1.
- Mobile native apps. PWA only.
- Server-side email storage of any kind, including caches longer than a single function invocation.
- Verified-app OAuth (Google's restricted-scope review). v1 ships in test-users mode.

---

## 2 · AI-first product principles

These are claims that must hold across every feature. If a feature breaks one of these, it's wrong.

1. **The wow happens in the first 5 seconds.** The home screen is the triaged inbox, not a folder list. Judges who spend 90 seconds on the app see the AI doing real work.
2. **AI is one batched call per sync.** Triage, summary, and reply-draft come from a single structured-output LLM call — not three independent calls. This is the prompt-caching win and the architectural-clarity win.
3. **The LLM is a pluggable interface, not a vendor lock.** Anthropic (default, with prompt caching), OpenAI, and Gemini are interchangeable behind one `LLMProvider` contract.
4. **Email content never persists outside the user's browser.** The privacy story is defensible and load-bearing for the product narrative.
5. **The product is usable even if the AI fails.** Triage degrades to chronological inbox. Suggested-reply degrades to empty compose. AI errors do not block mail reading.

---

## 3 · Architecture (three tiers)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  TIER 1 — Browser (PWA)                                                    │
│                                                                            │
│   UI Shell ── Sync Engine ── Local Store ── Service Worker                 │
│   (Next.js)   (Web Worker)   (Dexie/IDB)    (offline + manifest)           │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                              │  HTTPS · stateless · no email at rest
                              ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  TIER 2 — Vercel Functions (thin proxies)                                  │
│                                                                            │
│   /api/auth/*       /api/imap/*           /api/ai/*                        │
│   OAuth callbacks   IMAP TCP proxy        LLM router                       │
│   (Auth.js)         (ImapFlow)            (LLMProvider interface)          │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                              │ ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  TIER 3 — External providers                                               │
│                                                                            │
│   Gmail API · Microsoft Graph · IMAP (Yahoo/AOL) · LLMs (3 vendors)        │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Why three tiers, why this thin

- **Tier 2 is stateless** because state needs a database, and a database needs administration, money, and a custody story. Avoiding it is the *point*, not a shortcut.
- **Tier 2 cannot be removed** because (a) browsers can't open raw TCP, so IMAP needs a proxy, and (b) the LLM API key must stay server-side or it leaks.
- **Tier 1 talks to Gmail/Graph directly** for reads, sends, label changes — there's no value adding a hop through Tier 2 for those, and going direct saves a round-trip. **AI calls always route through Tier 2** because the LLM API key must stay server-side.

### 3.2 What's *not* in the diagram (deliberately)

- **No database.** No Postgres, no KV, no Redis, no S3. Free-tier Vercel carries the whole stack.
- **No real-time push.** Poll-based sync only. See §10.
- **No background workers off Vercel.** Sync runs in a Web Worker *inside the user's browser*.

---

## 4 · Data model (everything in the browser)

All data lives in IndexedDB, accessed via Dexie. Schema:

```ts
// db.ts (canonical)
accounts:    { id, provider, label, email, oauthTokens?, imapCreds?, lastSync }
messages:    { id, accountId, threadId, from, to, cc, subject, snippet, body,
                receivedAt, labels[], flags[], aiResult? }
threads:     { id, accountId, subject, participants[], messageIds[], updatedAt }
aiResults:   { messageId, bucket, summary, suggestedReply?, model, processedAt,
                promptCacheHit, version }
syncCursors: { accountId, providerCursor, lastFullSyncAt }
settings:    { llmProvider, byokKey?, syncIntervalSec, theme }
```

- **Tokens at rest in IndexedDB**: v1 ships *two modes*.
  - **Convenience mode (default)**: tokens stored in IndexedDB as-is. Same-origin isolation is the only barrier — which is the same guarantee Gmail.com and outlook.com themselves provide for their own session cookies. The privacy claim is *"we have no server-side database,"* not *"we encrypt locally."*
  - **Hardened mode (opt-in setting)**: user enters a passphrase; WebCrypto (AES-GCM) derives a key via PBKDF2 and encrypts tokens at rest. Passphrase re-entered per session. Documented as the trade-off it is.
- **`aiResult.version`** lets us re-run AI when prompts change without nuking the local DB.
- **`promptCacheHit`** is the metric we'll surface in the writeup ("78% of AI calls hit the prompt cache after the first sync").
- **Dexie migrations** are versioned in `db.ts`. No destructive schema changes after v1.

---

## 5 · Provider abstraction (`MailProvider` interface)

Every email backend implements the same interface. The unified inbox is then trivial — concat across accounts, sort by `receivedAt`.

```ts
interface MailProvider {
  readonly id: string;          // "gmail" | "outlook" | "imap"
  list(cursor?: string, since?: Date): Promise<{ messages: Message[]; nextCursor?: string }>;
  get(messageId: string): Promise<MessageFull>;
  send(draft: Draft): Promise<{ messageId: string }>;
  archive(messageId: string): Promise<void>;
  delete(messageId: string): Promise<void>;
  setLabel(messageId: string, label: string, on: boolean): Promise<void>;
  search(query: string): Promise<Message[]>;
}
```

### 5.1 Three implementations

| Provider | Transport | Auth | Notes |
|---|---|---|---|
| **GmailProvider** | REST (browser → Gmail API direct) | OAuth (test users) | Labels = native Gmail labels. Search = `q=` operator. |
| **OutlookProvider** | REST (browser → Graph direct) | OAuth (test users) | Labels = categories. |
| **ImapProvider** | Browser → `/api/imap/*` → IMAP server | App password | Labels = IMAP folders. Search = `IMAP SEARCH`. Sync via `UIDNEXT` cursor. |

### 5.2 Account switching + unified inbox

`AccountSwitcher` UI component reads `accounts[]` from store and routes the active provider into a React context. Unified view fans out across all accounts in parallel via `Promise.all`.

---

## 6 · AI abstraction (`LLMProvider` interface)

```ts
interface LLMProvider {
  readonly id: "anthropic" | "openai" | "gemini";
  triageBatch(emails: TriageInput[]): Promise<TriageResult[]>;
  draftReply(email: Email, ctx: ReplyContext): Promise<string>;
}
```

All prompts live in `lib/ai/prompts.ts`, shared across providers. Only the wire-format differs.

### 6.1 The single triage prompt

The triage call takes up to **N=20 new messages** per batch (configurable) and returns structured JSON:

```json
[
  {
    "messageId": "...",
    "bucket": "needs_reply" | "fyi" | "newsletter" | "noise",
    "summary": "one-line, ≤120 chars, present tense",
    "suggestedReply": "≤300 chars, only if bucket=needs_reply, else null"
  },
  ...
]
```

- **Anthropic path**: uses `cache_control: ephemeral` on the system prompt + few-shot examples. After call 1 in a session, subsequent calls hit the prompt cache → roughly 70-80% cost reduction on the prefix portion.
- **OpenAI path**: structured outputs via `response_format: { type: "json_schema" }`.
- **Gemini path**: function-calling with a fixed schema.
- **All paths validate** the response with Zod before writing to the store. Validation failures retry once, then fall back to an empty `aiResult` and a chronological inbox (principle #5).

### 6.2 Reply-draft prompt

Separate prompt, called on demand when the user clicks "Suggest a reply" in a thread view. Takes thread context, returns a single ≤500-char draft. The pre-drafted reply from §6.1 is shown first; the on-demand draft is for refinement.

### 6.3 BYOK (bring your own key)

Settings panel exposes a key field per provider. If set, `/api/ai/*` uses it for that user's requests. Key is stored in IndexedDB, sent on every request, never persisted server-side. Default = our shared Anthropic key (rate-limited per-IP).

---

## 7 · UI surfaces (four screens)

### 7.1 Triaged Inbox (home)

- Four collapsible sections (`Needs reply`, `FYI`, `Newsletters`, `Noise`).
- Each card: sender, subject, one-line AI summary, time. If bucket=`needs_reply`, a "Suggested reply" chip is shown — tap to expand.
- **FLIP-animated reflow** when AI completes: cards visibly move into their buckets. This is *the* signature moment.
- Swipe gestures: swipe-left = archive, swipe-right = delete (both rubber-banded, both undoable for 5s).

### 7.2 Thread view

- Linear conversation, oldest-first.
- Top of screen: thread summary (AI), generated on first open and cached.
- Bottom of screen: pre-drafted reply (from triage) + "Regenerate" + "Send" + "Edit".

### 7.3 Compose drawer

- Slides up from bottom (mobile-native).
- "Rewrite tone" — single button, three options in a sub-menu (concise / warm / formal).
- Send routes through the active account's `MailProvider.send()`.

### 7.4 Search

- Top-bar search input visible on every screen.
- Hybrid strategy: queries first hit the **local Dexie index** (instant, works offline) for already-synced messages; in parallel, the active provider's `search()` is called for un-synced matches (Gmail `q=`, Graph `$search`, IMAP `SEARCH`).
- Results merge, dedupe by `messageId`, sort by `receivedAt`.
- Labels and bucket pills are searchable terms: `bucket:needs_reply from:sarah`.

### 7.5 Settings

- Account list + add-account flows (3 buttons: Google / Microsoft / IMAP).
- LLM provider selector + BYOK key fields.
- Sync interval slider.
- Theme: dark only at v1 (Neo-Editorial Dark — see §8).

---

## 8 · Aesthetic direction · Neo-Editorial Dark

Locked direction. Token-level guidance:

| Token | Value |
|---|---|
| Background | `#0f0f14` (canvas), `rgba(255,255,255,.04)` (cards) |
| Body type | Inter (system fallback) |
| Display type | Fraunces (variable, italic for accents) |
| Mono type | JetBrains Mono (timestamps, addresses) |
| AI accent | `#a78bfa` (purple) — every AI-generated element wears this |
| Bucket colors | `Needs reply` = purple, `FYI` = blue, `Newsletters` = amber, `Noise` = neutral |
| Radii | 8px (cards), 10px (drawers), 999px (pills) |
| Shadows | None. Use `border: 1px solid rgba(255,255,255,.08)` and `backdrop-filter: blur(8px)` for depth. |
| Motion | Framer Motion + View Transitions API. Cubic-bezier `(0.4, 0, 0.2, 1)`, durations 150–280ms. |

The italic Fraunces display font, the purple AI accent, and the absence of shadows are the **three things a reviewer will remember**. We commit to those.

---

## 9 · Sync engine

- Runs in a **Web Worker** so the UI thread is never blocked.
- Triggered on (a) app focus, (b) every `settings.syncIntervalSec` seconds, (c) user pulls to refresh.
- Per-account cursor stored in `syncCursors`. For Gmail/Graph, this is a `historyId`. For IMAP, it's `UIDNEXT`.
- After fetching new messages, the worker **batches them and calls `/api/ai/triage`** — one HTTP call regardless of how many new messages, up to N=20 per batch (multiple batches if more).
- Results written to IndexedDB. UI subscribes via Dexie's reactive queries and re-renders.

---

## 10 · Failure modes (explicit)

| Failure | Detection | Recovery |
|---|---|---|
| **Gmail rate-limit (429)** | Status code | Exponential back-off `[1, 2, 5, 15]s`, max 4 retries. After that, surface a soft banner: "Gmail is throttling us — retrying in a minute." Inbox keeps showing cached state. |
| **IMAP connection drops mid-sync** | `ImapFlow` error event | Discard partial batch, retain previous cursor, retry on next tick. Never write partial state. |
| **OAuth token expired** | 401 from provider | Refresh token flow via Auth.js. If refresh fails, prompt re-auth with the offending account highlighted. Other accounts continue working. |
| **LLM returns malformed JSON** | Zod validation fail | Retry once with `temperature=0`. If still bad, write empty `aiResult` and fall back to chronological inbox. UI shows a small "AI unavailable for this batch" badge. |
| **LLM rate-limit** | 429 from vendor | Same back-off. If sustained, auto-switch to the next configured `LLMProvider` (if any). User sees a "switched to OpenAI" toast. |
| **IndexedDB write fails** | Dexie error event | Surface fatal banner. Most likely cause: disk full or private-window quota. Provide a "clear cache" escape. |
| **Service worker stale** | Version mismatch on activate | Auto-reload UI on `controllerchange`. |

---

## 11 · Multi-agent workflow (the rubric piece)

The build is decomposed into specialist agents, dispatched per phase. The git log will literally show parallel branches per agent — agent name appears in commit messages (e.g., `[ai-agent] add Anthropic prompt-caching` ).

### 11.1 Phase topology

| Phase | Agent(s) | Skills | Output |
|---|---|---|---|
| **0 — Brainstorm** | `general-purpose` | `brainstorming` | This spec. |
| **1 — Plan** | `Plan` agent | `writing-plans`, `using-git-worktrees` | Implementation plan with file map + interface contracts. |
| **2 — Build (parallel)** | `infra-agent`, `provider-agent`, `pwa-agent`, `ai-agent`, `ui-agent`, `test-agent` | `frontend-design`, `webapp-testing`, `claude-api`, `TDD`, `systematic-debugging`, `dispatching-parallel-agents` | All code, all tests. |
| **3 — Polish** | `review-agent`, `doc-agent` | `requesting-code-review`, `security-review`, `simplify` | Code review, README, architecture doc, accessibility audit. |
| **4 — Ship** | `ship-agent` | `verification-before-completion`, `finishing-a-development-branch` | Vercel deploy, metric capture, demo video. |

### 11.2 Parallelism contract

Phase 2 agents are independent because the planner-agent (Phase 1) will define interfaces first:

- `MailProvider` interface → `provider-agent` and `ui-agent` can build against the same contract independently.
- `LLMProvider` interface → `ai-agent` and `ui-agent` can build against it independently.
- Dexie schema → `pwa-agent` defines, everyone imports.

At peak we run **three Phase-2 agents in parallel** via git worktrees, not all six, to keep cognitive load manageable.

### 11.3 Skills, hooks, plugins

**Plugins installed:**
- `claude-plugins-official/superpowers@5.1.0`
- `anthropics/skills/frontend-design`
- `anthropics/skills/webapp-testing`

**Skills explicitly used (in order of first use):**
`brainstorming → writing-plans → using-git-worktrees → dispatching-parallel-agents → subagent-driven-development → frontend-design → claude-api → webapp-testing → test-driven-development → systematic-debugging → requesting-code-review → security-review → verification-before-completion → finishing-a-development-branch`

**Hooks (`.claude/settings.json`):**

| Hook | Command | Purpose |
|---|---|---|
| `pre-commit` | `tsc --noEmit && pnpm lint --changed && pnpm test:unit --changed` | Type-safe, lint-clean, changed-file tests pass. |
| `pre-push` | `pnpm test:unit && pnpm build` | Full unit suite + Next.js build success. |
| `pre-tool-use (Bash)` | Block if staged paths match `**/.env*` | No accidental secret leaks. |
| `post-tool-use (Write/Edit)` | `prettier --write` on changed file | Auto-format on every write. |
| `session-start` | Show `CLAUDE.md` | Re-prime context every session. |
| `Stop` / `SubagentStop` | Log agent identity to a session log file | Used by `doc-agent` in Phase 3 to assemble the workflow writeup. (Agent-name commit tagging is enforced by *convention* — each agent's prompt mandates a `[agent-name]` prefix on its commits — not by a hook, since commits aren't a hookable event.) |

---

## 12 · Testing strategy

| Layer | Tool | Coverage target |
|---|---|---|
| **Unit** | Vitest + Testing Library | 80% on `lib/` (providers, LLM adapters, sync engine), 60% on UI components. |
| **Integration** | Vitest + MSW | All three providers mocked. Sync engine end-to-end against mocks. AI adapters all three vendors. |
| **E2E** | Playwright | One golden-path test per provider (Gmail, Outlook, IMAP). Triage happy path. Compose + send. Offline mode. |
| **Visual regression** | Playwright screenshots | Triaged inbox, thread view, compose drawer. Guards the aesthetic from regressions. |
| **Accessibility** | `@axe-core/playwright` | Zero violations on every e2e route. |

CI runs all four layers on every PR via GitHub Actions. The `pre-push` hook runs unit + build only, to keep local velocity.

---

## 13 · PWA features

- **Manifest**: `name`, `short_name="UA Email"`, `display=standalone`, theme color `#0f0f14`, icons 192/512.
- **Service worker** (via next-pwa / workbox): caches the app shell + last-synced inbox state. Offline: read-only inbox, queued sends (sent on reconnect).
- **No push notifications.** Stretch goal.
- **Installable** on iOS Safari, Android Chrome, desktop Chrome/Edge — meeting the "mobile-ready" requirement.

---

## 14 · Auth flows

### 14.1 Google (test mode)

1. App-side: "Sign in with Google" → Auth.js initiates OAuth with scopes `gmail.readonly`, `gmail.send`, `gmail.modify`, `openid email profile`.
2. Google consent screen warns "unverified app" — accepted because the user is added as a test user in the Google Cloud Console.
3. Tokens returned to `/api/auth/callback/google`, set on a `Secure; HttpOnly; SameSite=Lax` session cookie (short-lived).
4. Browser then hits `/api/auth/handoff` to retrieve the tokens once, server clears the cookie, browser writes tokens to IndexedDB (and optionally encrypts under hardened mode — see §4). After this, the server holds nothing.

### 14.2 Microsoft (test mode)

Same shape via Azure AD personal-account app registration. Scopes: `Mail.ReadWrite`, `Mail.Send`, `User.Read`, `offline_access`.

### 14.3 IMAP

1. User selects "Connect via IMAP" → form: email, app password, server (auto-detected from domain for Yahoo/AOL/Gmail/Outlook).
2. Credentials encrypted in IndexedDB, decrypted server-side per IMAP request, never persisted on the server.

---

## 15 · Scale story (what changes at 10k users)

The free-tier architecture has a known ceiling. At ~10k DAU we would:

1. **Move IMAP off Vercel** to a Fly.io / Railway worker that holds IMAP IDLE connections for real-time push.
2. **Introduce Redis** (Upstash) for OAuth token refresh coordination and per-user rate-limit budgets.
3. **Add a queue** (Inngest / BullMQ) for AI calls so the LLM batch is decoupled from sync.
4. **Add Postgres** *only if* we ship cross-device sync — and even then, encrypted-at-rest with user-derived keys so the no-data-at-rest principle survives in spirit.
5. **CDN/edge** the static shell — already free on Vercel.

None of the above is implemented for v1. They are *what we'd do next*, documented to demonstrate that the current shape is a deliberate choice for a given scale, not the limit of imagination.

---

## 16 · Evidence package (six items, all spec deliverables)

These ship with v1. They are how the work is *seen*, not separate work items.

1. **Metric numbers in the writeup**. Three numbers: `prompt cache hit rate`, `p95 first contentful paint`, `unit + integration test coverage %`. Captured by `ship-agent` from the live deploy.
2. **"What changes at scale" paragraph** — already §15 of this spec, lifted verbatim into the architecture doc.
3. **Failure modes table** — already §10, lifted verbatim into the architecture doc.
4. **60–90 second Loom-style demo video**, linked from the README hero. Script (kept tight): 0–10s open app, see triaged inbox populate with FLIP animation. 10–35s tap a `Needs reply` card, show the pre-drafted reply, edit a word, send. 35–55s switch to a second account, show unified inbox. 55–80s open settings, swap LLM provider, sync re-triages live. 80–90s tagline + repo link.
5. **README as a sales document.** Above the fold: hero screenshot of triaged inbox + two bullets on the AI-first claim + live URL + demo video link. Setup instructions live below the fold.
6. **Accessibility line + audit.** WCAG AA color contrast verified, full keyboard navigation, ARIA on every triage card with `aria-label` describing bucket + summary. `@axe-core/playwright` zero-violation gate in CI.

---

## 17 · Deliverables checklist (what gets handed to the recruiter)

- [x] **This spec** — `docs/superpowers/specs/2026-05-14-ua-email-design.md` (committed).
- [ ] **Implementation plan** — `docs/superpowers/plans/2026-05-14-ua-email-plan.md` (produced by `writing-plans` next).
- [ ] **Live Vercel URL** with three working account types (Google test-user, Microsoft test-user, IMAP).
- [ ] **`CLAUDE.md`** at repo root — agent personas, build conventions, the "principles" from §2.
- [ ] **`docs/architecture.md`** — one-page version of §3 + §10 + §15.
- [ ] **`docs/agents-skills-hooks.md`** — one-page version of §11.
- [ ] **`docs/workflow.md`** — short writeup: how the spec → plan → multi-agent → ship loop actually ran. Quoted commit messages. Real numbers.
- [ ] **README** — see §16, item 5.
- [ ] **60–90s demo video** — see §16, item 4.

---

## 18 · Open questions / known risks

- **Risk: Google blocks test-user OAuth on submission day.** Mitigation: IMAP path works for all four providers (Gmail/Outlook expose IMAP with app passwords). Documented in README as the universal fallback.
- **Risk: Vercel function timeout on large IMAP folders.** Mitigation: IMAP sync is paginated; per-call limit of 50 messages. Cursor-resumable.
- **Risk: AI cost on shared key during live judging.** Mitigation: per-IP rate limit on `/api/ai/*`, BYOK option exposed prominently in settings, Anthropic prompt caching turned on by default.
- **No open spec questions remain.** All architectural forks are resolved.

---

*End of spec. Next step: `superpowers:writing-plans` to produce the implementation plan.*
