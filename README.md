# UA Email · Universal AI-First Email Client

> **Live demo:** https://ua-email-pee0qzfyj-shakulmittal22s-projects.vercel.app/
> **Status:** Phase 1 (Foundation) complete — Phase 2 (provider + AI + UI implementations) in progress.

An AI-first, mobile-ready PWA that unifies Gmail, Office 365, and IMAP mail into a single inbox — with **batched AI triage** as the home screen, suggested replies, and a pluggable LLM layer (Anthropic, OpenAI, Gemini).

## What works in Phase 1

- Deployed Next.js 15 PWA shell on Vercel
- Three-tier architecture in place: browser store (Dexie) + Vercel function proxies (`/api/auth`, `/api/imap`, `/api/ai/triage`) + external providers
- All domain types + `MailProvider` + `LLMProvider` interfaces defined
- Dexie schema v1 + composite-index queries tested
- Vitest unit + Playwright e2e + axe-core a11y all green in CI
- Multi-agent topology + hooks live in `.claude/settings.json`

## What's coming in Phase 2+

See the [foundation plan](docs/superpowers/plans/2026-05-14-foundation-plan.md) and the [design spec](docs/superpowers/specs/2026-05-14-ua-email-design.md).

The recruiter-facing README (hero screenshot, demo video, the AI-first claim) replaces this file at the end of Phase 3 (`doc-agent`).

## Local development

```bash
pnpm install
cp .env.example .env.local   # then fill in your OAuth + LLM keys
pnpm dev
```

## Stack

Next.js 15 · TypeScript strict · Tailwind + shadcn · Framer Motion · Dexie · Auth.js v5 · ImapFlow · Anthropic / OpenAI / Gemini SDKs · Vitest · Playwright · MSW · GitHub Actions · Vercel.
