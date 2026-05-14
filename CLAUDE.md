# CLAUDE.md — UA-Email

> This file is loaded into every Claude Code session in this repo. It is the contract between agents working on this codebase.

## What this project is

UA-Email is an AI-first, mobile-ready Progressive Web App that unifies email across Gmail, Office 365, and IMAP (Yahoo/AOL) providers. The differentiator is the **triaged inbox home screen** — every sync invokes one batched LLM call that classifies new mail into `Needs reply / FYI / Newsletters / Noise`, writes a one-line summary per email, and pre-drafts replies.

**Full design spec:** `docs/superpowers/specs/2026-05-14-ua-email-design.md` — read this before making non-trivial changes.

## Five product principles (load-bearing — don't violate)

1. The wow happens in the first 5 seconds — the home screen is the triaged inbox.
2. AI is one batched call per sync (triage + summary + suggested reply in one structured-output request).
3. The LLM is a pluggable interface (`LLMProvider`). Default Anthropic with prompt caching. OpenAI + Gemini supported.
4. Email content never persists outside the user's browser. IndexedDB is the canonical store.
5. The product is usable even when the AI fails — degrade to chronological inbox.

## Multi-agent topology

The build is decomposed into specialist agents. Each agent owns a slice; agents don't reach into each other's files.

| Agent | Slice | Skills |
|---|---|---|
| `infra-agent` | Scaffold, Vercel config, Tailwind, shadcn, CI | `frontend-design`, `TDD` |
| `provider-agent` | Auth.js, `GmailProvider`, `OutlookProvider`, `ImapProvider`, `/api/imap` | `TDD`, `systematic-debugging` |
| `pwa-agent` | Service worker, manifest, Dexie schema + migrations, sync engine (Web Worker) | `TDD`, `webapp-testing` |
| `ai-agent` | `LLMProvider`, Anthropic/OpenAI/Gemini adapters, prompts, prompt caching, `/api/ai/*` | `claude-api`, `TDD` |
| `ui-agent` | Inbox triage view, thread view, compose drawer, settings, search bar | `frontend-design`, `webapp-testing` |
| `test-agent` | Vitest unit + Playwright e2e + MSW provider mocks + a11y gates | `webapp-testing`, `TDD`, `verification-before-completion` |
| `review-agent` | Independent code review across PRs / branches | `requesting-code-review`, `security-review` |
| `doc-agent` | README, architecture doc, workflow writeup, accessibility audit | `frontend-design`, `simplify` |
| `ship-agent` | Vercel deploy, metric capture, demo video | `verification-before-completion`, `finishing-a-development-branch` |

**Commit message convention** — every commit MUST be prefixed with `[<agent-name>]`. This is how the git log proves the multi-agent claim in the recruiter writeup. Example: `[ai-agent] feat: add Anthropic prompt caching`.

## Build conventions

- **Package manager:** pnpm (never npm or yarn in this repo).
- **TypeScript:** strict mode is on. `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are on. Do not relax these.
- **Imports:** use `@/` path alias. No relative imports beyond one level (`./foo` OK, `../../bar` not).
- **Validation:** every external response (Gmail/Graph/IMAP/LLM) is validated with **Zod** before it touches IndexedDB. No exceptions.
- **Server boundaries:** `/api/*` routes are stateless. They MUST NOT cache email, tokens, or user data beyond a single request. The only `Set-Cookie` allowed is the short-lived OAuth handoff cookie.
- **No emojis in code, commits, or docs.** Unless explicitly requested.
- **No comments that restate the code.** Comments only when the *why* is non-obvious.

## Skills used (in order of build)

`brainstorming → writing-plans → using-git-worktrees → dispatching-parallel-agents → subagent-driven-development → frontend-design → claude-api → webapp-testing → test-driven-development → systematic-debugging → requesting-code-review → security-review → verification-before-completion → finishing-a-development-branch`

## Hooks (configured in `.claude/settings.json`)

- `pre-commit`: typecheck + lint + changed-file unit tests
- `pre-push`: full unit suite + `next build`
- `pre-tool-use(Bash)`: block staged `.env*` files from commit
- `post-tool-use(Write/Edit)`: Prettier on changed file
- `Stop` / `SubagentStop`: append agent name to `.superpowers/agent-log` for the writeup

## Aesthetic — Neo-Editorial Dark

- Canvas `#0f0f14`. Card background `rgba(255,255,255,0.04)` with `rgba(255,255,255,0.08)` border. No drop shadows — depth via subtle borders and `backdrop-filter: blur(8px)`.
- AI accent: `#a78bfa` (purple). Every AI-generated piece of UI wears this color.
- Bucket colors: needs-reply purple, FYI blue, newsletter amber, noise neutral.
- Body type: Inter. Display type: Fraunces (italic for accents). Mono: JetBrains Mono (timestamps, addresses, code-feel).
- Motion: Framer Motion + View Transitions API. 150–280ms durations. Spring on FLIP reflow only.

## What's intentionally NOT here

- No calendar, contacts, tasks, notes (out of scope per brief).
- No real-time push notifications (poll-based sync only).
- No conversational chat sidebar (stretch goal, not v1).
- No server-side database. No Postgres, no Redis, no S3.

## Reading order for new sessions

1. This file.
2. `docs/superpowers/specs/2026-05-14-ua-email-design.md` (the canonical spec).
3. The plan currently being executed (in `docs/superpowers/plans/`).
4. The slice of code you're about to touch.

Do not modify code outside your agent's slice without a `review-agent` checkpoint.
