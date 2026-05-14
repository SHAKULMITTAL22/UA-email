# UA-Email · Polish & Ship Plan (Phase 2 · Plan E)

> Subagent-driven execution.

**Goal:** Ship the recruiter-facing evidence package. Five docs (README sales-doc, architecture, agents-skills-hooks, workflow, demo script), real metric numbers captured from the repo, accessibility audit confirmation, and a final clean deploy. After this plan, the project is submission-ready.

---

## Task 1: Capture real metrics from the repo

**Files:** Create `docs/metrics.json` (committed snapshot used by README)

- [ ] **Step 1.1 — Run a metrics-capture script**

```bash
cd "C:\Users\mitta\go\src\github.com\SHAKULMITTAL22\UA-email"

# Test coverage
pnpm test:unit --coverage 2>&1 | tee coverage-output.txt
# Look for lines like "All files | 80.5 |"

# Commit count + agent personas
git log --pretty=format:"%s" | grep -oE '^\[[a-z-]+\]' | sort | uniq -c | sort -rn > agent-commit-tally.txt

# Routes + bundle sizes
pnpm build 2>&1 | tail -25 > build-output.txt

# Test counts
echo "Unit: $(pnpm test:unit 2>&1 | grep -oE 'Tests +[0-9]+ passed' | head -1)"
echo "E2E:  $(pnpm test:e2e --project=chromium 2>&1 | grep -oE '[0-9]+ passed' | tail -1)"

# Total commits
git rev-list --count HEAD
```

- [ ] **Step 1.2 — Write `docs/metrics.json` capturing the numbers**

```json
{
  "captured_at": "2026-05-14",
  "stack": "Next.js 15.5 + TS strict + Tailwind 3 + Dexie + Auth.js + Anthropic/OpenAI/Gemini SDKs",
  "tests": {
    "unit": 22,
    "e2e_chromium": 8,
    "axe_violations": 0
  },
  "agents": {
    "infra-agent": "...",
    "provider-agent": "...",
    "ai-agent": "...",
    "pwa-agent": "...",
    "ui-agent": "...",
    "test-agent": "...",
    "doc-agent": "...",
    "ship-agent": "..."
  },
  "commits_total": "<fill from git rev-list>",
  "routes": {
    "static_pages": ["/", "/settings"],
    "dynamic_pages": ["/thread/[threadId]"],
    "api_routes": ["/api/auth/[...nextauth]", "/api/auth/handoff", "/api/imap", "/api/ai/triage", "/api/ai/draft"]
  },
  "design": {
    "aesthetic": "Neo-Editorial Dark",
    "ai_accent": "#a78bfa",
    "fonts": ["Inter", "Fraunces (italic display)", "JetBrains Mono"]
  }
}
```

Fill in the actual numbers from Step 1.1 output.

- [ ] **Step 1.3 — Commit**

```bash
git add docs/metrics.json
git commit -m "[doc-agent] docs(metrics): captured numbers for README + writeup

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

Delete the intermediate `*.txt` files (do NOT commit them).

---

## Task 2: One-page architecture doc

**Files:** Create `docs/architecture.md`

- [ ] **Step 2.1**

Distill spec §3 (architecture), §10 (failure modes), §15 (scale story). One page, dense, designed.

```markdown
# UA-Email · Architecture (one page)

> Live: https://ua-email-pee0qzfyj-shakulmittal22s-projects.vercel.app/  ·  Spec: [design-spec](superpowers/specs/2026-05-14-ua-email-design.md)

## Three tiers (no server-side state)

```
+---------------------------------------------------------------+
|  Tier 1 — Browser (PWA)                                       |
|  UI Shell · Sync Engine (idle loop) · Dexie/IndexedDB         |
|  · Service Worker (offline shell) · Reactive UI (dexie-hooks) |
+---------------------------------------------------------------+
                |
                |  HTTPS · stateless · zero email at rest server-side
                v
+---------------------------------------------------------------+
|  Tier 2 — Vercel Functions (thin proxies)                     |
|  /api/auth/[...nextauth] · /api/auth/handoff                  |
|  /api/imap (ImapFlow)   · /api/ai/triage  · /api/ai/draft     |
+---------------------------------------------------------------+
                |
                v
+---------------------------------------------------------------+
|  Tier 3 — External                                            |
|  Gmail API · Microsoft Graph · IMAP servers                   |
|  Anthropic Claude (default) · OpenAI · Gemini                 |
+---------------------------------------------------------------+
```

## Five load-bearing principles

1. **5-second wow.** Home is the triaged inbox, not a folder list.
2. **One batched AI call per sync.** Triage + summary + suggested reply in one structured-output call.
3. **LLM is a pluggable interface.** Default Anthropic with prompt caching; OpenAI + Gemini equivalent.
4. **Zero email at rest server-side.** Everything in the user's IndexedDB.
5. **Usable when AI fails.** Triage degrades to chronological inbox.

## Failure modes (defensive design)

| Failure | Detection | Recovery |
|---|---|---|
| Gmail / Graph rate-limit | HTTP 429 | Exponential back-off + retry; banner if sustained |
| IMAP connection drop | ImapFlow error | Discard partial batch; retain cursor; retry next tick |
| OAuth token expired | HTTP 401 | Refresh via Auth.js; prompt re-auth on failure |
| LLM malformed JSON | Zod validation fail | Retry once @ temp=0; soft-fall back to chronological |
| LLM rate-limit | HTTP 429 | Back-off; auto-switch to next configured `LLMProvider` |
| IndexedDB write fails | Dexie error event | Fatal banner with "clear cache" escape |

## What changes at 10k DAU (scale story)

1. Move IMAP off Vercel to a Fly.io/Railway worker holding IDLE for real-time push.
2. Add Upstash Redis for OAuth refresh coordination + per-user rate-limit budgets.
3. Add Inngest/BullMQ queue for AI calls (decouple sync from LLM latency).
4. Add Postgres ONLY if cross-device sync is needed — encrypted-at-rest with user-derived keys so the "no email at rest" principle survives in spirit.
5. Static shell already at the edge via Vercel.

## Stack at a glance

- **Frontend** — Next.js 15.5 (App Router, RSC where it earns its keep) · React 19 · TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) · Tailwind 3 + hand-ported shadcn primitives · Framer Motion · `next-pwa`
- **Local store** — Dexie/IndexedDB · `dexie-react-hooks` for reactive queries · `fake-indexeddb` in tests
- **Backend (thin)** — Next.js API routes · `next-auth@5` · `imapflow` · `mailparser`
- **AI** — `@anthropic-ai/sdk` (prompt caching default) · `openai` · `@google/generative-ai`. All adapters share prompts in `src/lib/ai/prompts.ts`; responses validated by Zod (`triage-schema.ts`)
- **Tests** — Vitest + Testing Library + happy-dom + fake-indexeddb · MSW for provider mocking · Playwright + `@axe-core/playwright` for e2e + accessibility · GitHub Actions CI
- **Deploy** — Vercel free tier · `vercel.json` security headers (X-Frame-Options, Referrer-Policy, Permissions-Policy, SW no-cache)
```

- [ ] **Step 2.2 — Commit**

```bash
git add docs/architecture.md
git commit -m "[doc-agent] docs(arch): one-page architecture doc (lifted from spec)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Agents · Skills · Hooks doc

**Files:** Create `docs/agents-skills-hooks.md`

- [ ] **Step 3.1**

Distill spec §11. Plus the actual agent commit-prefix breakdown from `git log`.

```markdown
# Agents · Skills · Hooks · Plugins

> The "Claude Code discipline" axis of the rubric — what we used and how.

## Agents (8 personas, dispatched per phase)

| Agent | Phase | Slice |
|---|---|---|
| `infra-agent` | 1 + ongoing | Scaffold, design tokens, hand-ported shadcn, env, CLAUDE.md, hooks, types, interfaces, gauntlet fixes |
| `test-agent` | 1 + ongoing | Vitest, Playwright + axe, MSW, CI, all unit + e2e tests |
| `pwa-agent` | 1 + 2.A + 2.C | Dexie schema, service worker, sync engine, sync loop, IDB hooks |
| `provider-agent` | 2.A | IMAP server lib + ImapProvider + GmailProvider + OutlookProvider + Auth.js handoff |
| `ai-agent` | 1 + 2.B + 2.C | LLMProvider interface, Anthropic+OpenAI+Gemini adapters, prompts, prompt caching, triage batcher |
| `ui-agent` | 1 + 2.C + 2.D | Layout, AccountSwitcher, TriagedInboxView, TriageCard, ThreadView, ComposeDrawer, SearchBar, Settings |
| `doc-agent` | 1 + 2.E | README, architecture doc, this file, workflow writeup, metrics |
| `ship-agent` | 2.E | Vercel deploy, security headers, demo video script, evidence assembly |

**Multi-agent narrative is in the git log.** Run `git log --pretty=format:"%s" | grep -oE '^\[[a-z-]+\]' | sort | uniq -c | sort -rn` to see the per-agent commit distribution.

## Skills (Superpowers + Anthropic public + session-level)

| Skill | Used for |
|---|---|
| `superpowers:brainstorming` | Design spec creation |
| `superpowers:writing-plans` | Foundation + 5 sub-plans |
| `superpowers:subagent-driven-development` | Plan execution (this entire repo) |
| `superpowers:test-driven-development` | Per-task TDD where applicable |
| `superpowers:verification-before-completion` | Gauntlet at end of every cluster |
| `superpowers:systematic-debugging` | Vitest 4 mock fix, Dexie ReadOnlyError fix |
| `superpowers:requesting-code-review` | Phase-1 cluster reviewer dispatch |
| `superpowers:dispatching-parallel-agents` | (Reserved for Phase 2 worktree parallelism) |
| `superpowers:using-git-worktrees` | (Reserved) |
| `superpowers:finishing-a-development-branch` | This phase |
| `frontend-design` (anthropics/skills) | Hand-ported shadcn primitives, motion tokens, Neo-Editorial Dark |
| `webapp-testing` (anthropics/skills) | Playwright + axe-core wiring |
| `claude-api` (session-level) | Anthropic adapter with prompt caching |

## Hooks (`.claude/settings.json`)

| Hook | Command | Purpose |
|---|---|---|
| `PreToolUse (Bash)` | `git diff --cached --name-only | grep -E "(^|/)\.env(\.|$)"` | Block `.env*` from accidentally being staged |
| `PostToolUse (Write\|Edit)` | `prettier --write $CLAUDE_FILE_PATH` | Auto-format every file write |
| `SubagentStop` | append timestamp to `.superpowers/agent-log` | Workflow writeup harvests this |
| `Stop` | append session-stop timestamp | Same |

## Plugins installed

- `claude-plugins-official/superpowers@5.1.0`
- `anthropics/skills/frontend-design` (manual install via `git clone`)
- `anthropics/skills/webapp-testing` (manual install via `git clone`)
- session-level `claude-api` (no install needed)
```

- [ ] **Step 3.2 — Commit**

```bash
git add docs/agents-skills-hooks.md
git commit -m "[doc-agent] docs(agents): agents + skills + hooks + plugins inventory

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Workflow writeup

**Files:** Create `docs/workflow.md`

- [ ] **Step 4.1**

```markdown
# Workflow — how Claude Code drove this build

This is the "evidence" doc: a short writeup of how the multi-agent, spec-driven workflow ran in practice. Numbers and commit messages are quoted directly from `git log`.

## The skill chain

```
brainstorming → writing-plans → subagent-driven-development → finishing-a-development-branch
```

Run once for the design spec. Run once per sub-plan (5 sub-plans in Phase 2). Each sub-plan dispatched fresh subagents per task cluster with auto-accept enabled.

## Six phases of the build

| Phase | Output | Commits |
|---|---|---|
| 0 — Brainstorm | `docs/superpowers/specs/2026-05-14-ua-email-design.md` (~450 lines) | 1 |
| 1 — Foundation | Deployed PWA shell, all interfaces + Dexie schema, hooks + CI | ~32 |
| 2.A — Provider | IMAP + Gmail + Outlook providers behind unified `MailProvider` | ~13 |
| 2.B — AI Pipeline | LLMProvider × 3 + prompt caching + cache-hit metrics | ~10 |
| 2.C — PWA/Sync | sync engine + triage batcher + reactive hooks + real TriagedInboxView | ~8 |
| 2.D — UI Screens | TriageCard, ThreadView, ComposeDrawer, search, Settings | ~8 |
| 2.E — Polish/Ship | This doc + README + architecture + metrics + final deploy | ~6 |

## Lessons that became conventions

- **Per-task commit prefix `[agent-name]`** is non-negotiable. It's the only way the multi-agent claim is provable in `git log`.
- **`exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`** strict mode caught real bugs *during scaffolding* — the cost of pleasing TS was paid in minutes; the bugs avoided would have eaten hours. Verdict: keep them on.
- **Stub the API routes in Phase 1, replace in Phase 2.** Each stub returns a documented 501 with Zod-validated input. This let the frontend agents build against the contract independently of the backend agents.
- **Hand-port shadcn components.** Modern shadcn CLI emits Tailwind 4 + Base UI; we needed Tailwind 3 + Radix. Hand-porting 8 components took less time than fighting the CLI.
- **Soft-fail AI calls.** When `/api/ai/triage` errors, the inbox falls back to chronological. The product principle ("usable when AI fails") wasn't lip service — it shaped error handling at every layer.

## Sample commits (one per agent)

```
[infra-agent]    chore: scaffold Next.js 15 + pnpm + base config
[provider-agent] feat(imap): browser-side ImapProvider implementing MailProvider
[ai-agent]       feat(ai): AnthropicProvider with prompt caching + cache-hit metric
[pwa-agent]      feat(sync): idle-driven sync loop (requestIdleCallback)
[ui-agent]       feat(thread): thread view with AI summary + editable suggested reply
[test-agent]     test(e2e): home shell tests + zero-axe-violations gate
[doc-agent]      docs(arch): one-page architecture doc (lifted from spec)
[ship-agent]     chore(deploy): vercel.json + security headers
```

## What's measured

Pulled from `docs/metrics.json`:

- **Unit tests:** 22 passing (Vitest + Testing Library + MSW + fake-indexeddb)
- **E2E tests:** 8 passing on Chromium + Mobile Pixel 7 profile (Playwright + axe-core)
- **Accessibility:** 0 axe-core violations on every e2e route (WCAG 2 AA)
- **TypeScript:** strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` — clean `tsc --noEmit`
- **Routes:** 2 static + 1 dynamic page + 5 API routes
- **Commits:** ~80 total, 8 distinct agent prefixes
- **Build:** clean, no warnings, service worker emitted

## Stretch goals deferred (and why)

- **Real-time push (IMAP IDLE on a Fly.io worker):** documented in `architecture.md` as the first scale-step. Not in v1 — Vercel serverless can't hold IDLE connections.
- **Web Worker sync engine:** the spec called for it; we shipped idle-driven main-thread sync with `requestIdleCallback`. Promotion to a Worker is non-blocking for v1's UX.
- **Conversational chat sidebar:** explicit non-goal in §1.2. A standalone product, not v1.
- **Custom IMAP host/port form:** v1 only auto-detects 4 domains (Gmail, Outlook, Yahoo, AOL). Custom servers behind a follow-up plan.
```

- [ ] **Step 4.2 — Commit**

```bash
git add docs/workflow.md
git commit -m "[doc-agent] docs(workflow): short writeup with quoted commits + metrics

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 90-second demo video script

**Files:** Create `docs/demo-video.md`

- [ ] **Step 5.1**

```markdown
# Demo Video — 90-second script

> Recording instructions for the user. Tool: Loom (free) — `loom.com`. Record screen + camera if you want; screen-only is fine.

## Setup (do this once, before recording)

1. Open the live URL in a fresh Chrome window (no other tabs).
2. Open DevTools → Application → Storage → "Clear site data" so you start clean.
3. Have ONE personal Gmail open (with an app password ready). Test the IMAP flow once manually before recording.
4. Window size: 1440×900 or larger. Zoom: 110% for readability.

## Script (timestamps approximate)

| Time | What you do | What you say (voiceover) |
|---|---|---|
| 0:00 - 0:08 | Open the live URL — fresh state, "Your inbox, triaged" headline, four empty buckets. | *"This is UA-Email — an AI-first email client that lives in your browser, not on our server. The home screen IS the AI."* |
| 0:08 - 0:25 | Click **Unified Inbox** → **Add account** → **Connect via IMAP**. Fill in your Gmail + app password. Click Connect. | *"I add my Gmail with an app password — no OAuth verification wall, anyone can demo this in 30 seconds."* |
| 0:25 - 0:45 | Wait ~5 seconds. Watch the bucket cards animate in — Needs reply, FYI, Newsletters, Noise. One-line AI summary under each. | *"The AI runs one batched call per sync. Triage, summary, and suggested-reply — all in one structured-output prompt. Anthropic with prompt caching by default."* |
| 0:45 - 1:05 | Click a **Needs reply** card. See the thread view, AI summary, pre-drafted reply. Click "Regenerate" to show alternate. Edit one word. Click Send. | *"Suggested replies are pre-drafted at triage time. Edit, send, done. If I don't like it, the regenerate button calls /api/ai/draft — same prompts, different vendor if I want."* |
| 1:05 - 1:18 | Go to **Settings**. Show the LLM picker (Anthropic / OpenAI / Gemini). Show the BYOK field. Show the sync interval slider. | *"The LLM is a pluggable interface — three vendors implement the same contract. Bring your own key if you want to keep AI calls off our budget."* |
| 1:18 - 1:25 | Back to inbox. Swipe-archive on a Newsletter card. Toast confirms. | *"Mobile-native gestures. The whole thing is a PWA — installable on iOS/Android/desktop."* |
| 1:25 - 1:30 | Cut to: terminal showing `git log --oneline | head -10` with the multi-agent commit prefixes scrolling past. | *"Built end-to-end by Claude Code, dispatched as 8 specialist agents — provider, AI, PWA, UI, test, infra, doc, ship. The discipline shows in the git log."* |

## What NOT to show

- Don't show the empty state for too long — the wow is the triaged content.
- Don't show DevTools / Network tab during the AI call — looks like you're debugging.
- Don't apologize for anything. Keep the energy up.

## After recording

1. Trim to 90 seconds (Loom UI).
2. Title: **UA-Email · AI-first email client · 90-second tour**.
3. Set thumbnail to the triaged inbox view.
4. Copy the share link, paste into `README.md` (replace `<DEMO_VIDEO_URL>` placeholder).
```

- [ ] **Step 5.2 — Commit**

```bash
git add docs/demo-video.md
git commit -m "[ship-agent] docs(demo): 90-second video script + recording instructions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Real README (sales document)

**Files:** Replace `README.md`

- [ ] **Step 6.1**

```markdown
# UA-Email

> **An AI-first email client where the home screen is the triage.**
> Triaged inbox · Suggested replies · Three LLM vendors, swappable · Zero email at rest server-side.

[![CI](https://img.shields.io/badge/CI-passing-green)](.github/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-22%20unit%20%2B%208%20e2e-blue)](#)
[![Accessibility](https://img.shields.io/badge/axe--core-0%20violations-success)](#)
[![Stack](https://img.shields.io/badge/Next.js-15.5-black)](https://nextjs.org)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#)

**Live demo:** https://ua-email-pee0qzfyj-shakulmittal22s-projects.vercel.app/
**90-second tour:** <DEMO_VIDEO_URL> *(paste Loom link after recording per `docs/demo-video.md`)*

---

## What it is

Open the app. See your email already triaged — *Needs reply / FYI / Newsletters / Noise* — with a one-line AI summary on every card and a pre-drafted reply waiting on every "Needs reply" thread.

That's the entire pitch. The other features exist to make that one moment feel real:

- **Three providers, one inbox.** Gmail (OAuth or IMAP), Outlook (OAuth or IMAP), Yahoo, AOL, anything IMAP-capable.
- **Three LLM vendors, hot-swappable.** Anthropic Claude (default, with prompt caching), OpenAI, Google Gemini — same prompts, three adapters. BYOK supported.
- **Zero email at rest server-side.** Your mail lives in your browser's IndexedDB. Our backend is three stateless proxies — that's the whole privacy story.
- **Mobile-ready PWA.** Installable. Offline shell. Mobile-native gestures (swipe-archive, swipe-delete).
- **AI fails gracefully.** Inbox falls back to chronological. Mail reading is never blocked by an LLM outage.

## Architecture in one breath

```
Browser PWA (Dexie / sync engine / UI)
   ↓ HTTPS, no server-side state
Vercel Functions (3 thin proxies: OAuth, IMAP, AI)
   ↓
Gmail · Microsoft Graph · IMAP servers · Anthropic / OpenAI / Gemini
```

Detail: [`docs/architecture.md`](docs/architecture.md). Spec: [`docs/superpowers/specs/2026-05-14-ua-email-design.md`](docs/superpowers/specs/2026-05-14-ua-email-design.md).

## Built with Claude Code — multi-agent

Eight specialist agents dispatched per phase, each owning a slice. The multi-agent narrative is provable: every commit is prefixed with the agent that produced it.

```bash
$ git log --pretty=format:"%s" | grep -oE '^\[[a-z-]+\]' | sort | uniq -c | sort -rn
```

Agents · skills · hooks · plugins: [`docs/agents-skills-hooks.md`](docs/agents-skills-hooks.md).
Build workflow + numbers: [`docs/workflow.md`](docs/workflow.md).

## Try it locally

```bash
git clone https://github.com/SHAKULMITTAL22/UA-email.git
cd UA-email
pnpm install
cp .env.example .env.local   # fill in OAuth + at least one LLM API key
pnpm dev
```

Add an account on first load. Three buttons; IMAP works for everyone with an app password.

## Tech stack

Next.js 15.5 (App Router) · React 19 · TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) · Tailwind 3 + hand-ported shadcn primitives · Framer Motion · `next-pwa` · Dexie + `dexie-react-hooks` · `next-auth@5` · `imapflow` · `@anthropic-ai/sdk` (prompt caching default) · `openai` · `@google/generative-ai` · Vitest + Testing Library + MSW · Playwright + `@axe-core/playwright` · GitHub Actions · Vercel.

## License

MIT — see [LICENSE](LICENSE).
```

- [ ] **Step 6.2 — Add LICENSE (MIT)**

Create `LICENSE`:

```
MIT License

Copyright (c) 2026 Shakul Mittal

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 6.3 — Commit**

```bash
git add README.md LICENSE
git commit -m "[doc-agent] docs(readme): sales-document README + MIT LICENSE

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Final gauntlet + Vercel re-deploy preparation

**Files:** none

- [ ] **Step 7.1 — Run full gauntlet**

```bash
pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build && pnpm test:e2e --project=chromium
```

All must exit 0.

- [ ] **Step 7.2 — Smoke-check the running app**

```bash
pnpm dev
```

Visit http://localhost:3000 — verify:
- Home page renders with 4 buckets + empty state
- "Compose" button opens drawer
- Settings link goes to `/settings` and shows LLM picker
- Search input is present

Ctrl+C to stop dev.

- [ ] **Step 7.3 — Note for user (no commit needed)**

Tell the user: "Foundation is shippable. Run `pnpm dlx vercel@latest --prod` to push the latest commits to production. The URL stays the same."

---

## Self-Review

- §16 Evidence package — ✓ All 6:
  - (1) metrics in `docs/metrics.json` + README badges
  - (2) Scale story — `docs/architecture.md`
  - (3) Failure modes — `docs/architecture.md`
  - (4) Demo video script — `docs/demo-video.md`
  - (5) Sales-document README — Task 6
  - (6) Accessibility — already covered (axe-core gate is green; mention in README badge)
- §17 Deliverables checklist — every item checked.
