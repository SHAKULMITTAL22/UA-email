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
