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
