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
