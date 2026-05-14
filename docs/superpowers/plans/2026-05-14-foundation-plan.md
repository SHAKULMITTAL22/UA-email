# UA-Email · Foundation Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a deployed Vercel PWA shell with every contract, schema, hook, and CI gate that Phase 2's parallel agents will plug into. Phase 1 ends with a working, public, empty-state UA-Email page on the live URL, green CI, and `CLAUDE.md` + hooks enforcing discipline.

**Architecture:** Next.js 15 App Router + TypeScript on Vercel free tier. Three stateless API routes (`/api/auth`, `/api/imap`, `/api/ai/triage`) as stubs. Dexie/IndexedDB schema and `MailProvider` / `LLMProvider` interfaces declared but not implemented (those are Phase 2). Tailwind + shadcn + Framer Motion + Inter/Fraunces/JetBrains Mono installed and themed. Service worker + manifest in place. Vitest + Playwright + MSW + axe-core wired into CI via GitHub Actions.

**Tech Stack:**
- Next.js `15.x` (App Router) · TypeScript `5.x` · pnpm
- Tailwind CSS · shadcn/ui · Framer Motion · `next/font`
- Dexie.js `4.x` · Zod
- Auth.js v5 (`@auth/core` / `next-auth@beta`) · ImapFlow
- `@anthropic-ai/sdk` · `openai` · `@google/generative-ai`
- `next-pwa` / `@ducanh2912/next-pwa`
- Vitest · `@testing-library/react` · Playwright · MSW · `@axe-core/playwright`
- GitHub Actions

---

## File Structure (what this plan creates)

```
UA-email/
├── CLAUDE.md                            ← Task 6
├── README.md                            ← Task 30 (placeholder; replaced in Phase 3)
├── package.json                         ← Task 1
├── pnpm-lock.yaml                       ← (generated)
├── tsconfig.json                        ← Task 2
├── next.config.mjs                      ← Task 1
├── tailwind.config.ts                   ← Task 3
├── postcss.config.mjs                   ← Task 3
├── .gitignore                           ← extended in Task 1
├── .env.example                         ← Task 8
├── vercel.json                          ← Task 29
├── playwright.config.ts                 ← Task 10
├── vitest.config.ts                     ← Task 9
├── .github/workflows/ci.yml             ← Task 12
├── .claude/settings.json                ← Task 7
├── public/
│   ├── manifest.webmanifest             ← Task 19
│   ├── icon-192.png                     ← Task 19 (placeholder bytes)
│   └── icon-512.png                     ← Task 19 (placeholder bytes)
├── src/
│   ├── app/
│   │   ├── layout.tsx                   ← Task 18
│   │   ├── page.tsx                     ← Task 26
│   │   ├── globals.css                  ← Task 3
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts   ← Task 21
│   │       ├── auth/handoff/route.ts         ← Task 22
│   │       ├── imap/route.ts                 ← Task 23
│   │       └── ai/triage/route.ts            ← Task 24
│   ├── lib/
│   │   ├── types/{message,thread,account,ai}.ts   ← Task 13
│   │   ├── providers/mail-provider.ts        ← Task 14
│   │   ├── ai/llm-provider.ts                ← Task 15
│   │   ├── db/{schema,db}.ts                 ← Tasks 16-17
│   │   └── utils.ts                          ← (cn helper, Task 4)
│   ├── components/
│   │   ├── ui/                          ← shadcn primitives (Task 4)
│   │   ├── account-switcher.tsx         ← Task 25
│   │   └── triaged-inbox-view.tsx       ← Task 26
│   └── styles/motion-tokens.ts          ← Task 3
├── tests/
│   ├── e2e/smoke.spec.ts                ← Task 10, expanded Task 27
│   ├── unit/db.test.ts                  ← Task 17
│   └── mocks/handlers.ts                ← Task 11
└── docs/superpowers/
    ├── specs/2026-05-14-ua-email-design.md   (EXISTS)
    └── plans/2026-05-14-foundation-plan.md   (THIS FILE)
```

---

## Task 1: Scaffold Next.js 15 + pnpm + base config

**Files:**
- Create: `package.json`, `next.config.mjs`, `pnpm-workspace.yaml` (single-package), extends `.gitignore`

- [ ] **Step 1.1 — Install pnpm if missing**

```bash
npm install -g pnpm@9
pnpm --version   # expect 9.x
```

- [ ] **Step 1.2 — Initialize Next.js 15 (App Router, TypeScript, no example app)**

Run from repo root:

```bash
pnpm dlx create-next-app@15 . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack \
  --use-pnpm
```

When prompted about existing files (`.gitignore`, `docs/`, `.git/`), keep existing.

- [ ] **Step 1.3 — Pin Next.js + React versions**

Edit `package.json` `dependencies` block:

```json
{
  "dependencies": {
    "next": "15.0.3",
    "react": "19.0.0",
    "react-dom": "19.0.0"
  }
}
```

Then:

```bash
pnpm install
```

- [ ] **Step 1.4 — Configure `next.config.mjs` for PWA + strictness**

Overwrite `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
```

- [ ] **Step 1.5 — Extend `.gitignore` with Next + test artifacts**

Append to `.gitignore`:

```gitignore

# Added in foundation plan
.next/
out/
build/
coverage/
.playwright/
playwright-report/
test-results/
.vercel/
```

- [ ] **Step 1.6 — Commit**

```bash
git add package.json pnpm-lock.yaml next.config.mjs .gitignore tsconfig.json src/ public/ postcss.config.mjs tailwind.config.ts
git commit -m "[infra-agent] chore: scaffold Next.js 15 + pnpm + base config"
```

---

## Task 2: TypeScript strict mode + path aliases

**Files:** Modify `tsconfig.json`

- [ ] **Step 2.1 — Replace `tsconfig.json` with strict config**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext", "webworker"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", ".next", "out", "playwright-report"]
}
```

- [ ] **Step 2.2 — Verify typecheck passes on the scaffold**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2.3 — Commit**

```bash
git add tsconfig.json
git commit -m "[infra-agent] chore: enable strict TypeScript + path aliases"
```

---

## Task 3: Tailwind + design tokens (Neo-Editorial Dark)

**Files:**
- Modify: `tailwind.config.ts`, `src/app/globals.css`
- Create: `src/styles/motion-tokens.ts`

- [ ] **Step 3.1 — Overwrite `tailwind.config.ts` with the Neo-Editorial Dark token system**

```ts
import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0f0f14",
        card: "rgba(255,255,255,0.04)",
        cardBorder: "rgba(255,255,255,0.08)",
        textPrimary: "#fafafa",
        textMuted: "#a1a1aa",
        textDim: "#71717a",
        aiAccent: "#a78bfa",
        bucket: {
          needsReply: "#a78bfa",
          fyi: "#60a5fa",
          newsletter: "#facc15",
          noise: "#71717a",
        },
      },
      fontFamily: {
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "8px",
        drawer: "10px",
      },
      transitionTimingFunction: {
        "ua-out": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      transitionDuration: {
        ua: "200ms",
      },
      backdropBlur: { card: "8px" },
    },
  },
  plugins: [animate],
};

export default config;
```

- [ ] **Step 3.2 — Install missing plugins**

```bash
pnpm add -D tailwindcss-animate
```

- [ ] **Step 3.3 — Overwrite `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    color-scheme: dark;
  }

  html, body {
    background: #0f0f14;
    color: #fafafa;
    font-family: var(--font-inter), system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Subtle gradient noise to avoid flat black */
  body {
    background-image: radial-gradient(
      ellipse at top,
      rgba(139, 92, 246, 0.06),
      transparent 60%
    );
    min-height: 100vh;
  }
}
```

- [ ] **Step 3.4 — Create `src/styles/motion-tokens.ts`**

```ts
export const motion = {
  duration: {
    fast: 0.15,
    base: 0.20,
    slow: 0.28,
  },
  ease: {
    out: [0.4, 0, 0.2, 1] as const,
    in: [0.4, 0, 1, 1] as const,
    inOut: [0.4, 0, 0.2, 1] as const,
  },
  /** Spring for FLIP card reflow on triage updates */
  springReflow: {
    type: "spring" as const,
    stiffness: 380,
    damping: 32,
    mass: 0.6,
  },
} as const;
```

- [ ] **Step 3.5 — Verify build**

```bash
pnpm exec tsc --noEmit
pnpm build
```

Expected: build succeeds.

- [ ] **Step 3.6 — Commit**

```bash
git add tailwind.config.ts src/app/globals.css src/styles/motion-tokens.ts package.json pnpm-lock.yaml
git commit -m "[infra-agent] feat(design): Neo-Editorial Dark design tokens + motion system"
```

---

## Task 4: shadcn/ui + Framer Motion + `cn` helper

**Files:**
- Create: `src/lib/utils.ts`, `components.json`, initial `src/components/ui/button.tsx`

- [ ] **Step 4.1 — Install runtime deps**

```bash
pnpm add framer-motion class-variance-authority clsx tailwind-merge lucide-react
pnpm add -D @types/node
```

- [ ] **Step 4.2 — Create `src/lib/utils.ts`**

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4.3 — Initialize shadcn**

```bash
pnpm dlx shadcn@latest init --yes --base-color neutral --css-vars false
```

Accept defaults. Confirm `components.json` is created and points to `src/components/ui`.

- [ ] **Step 4.4 — Install the components we'll need in Phase 1**

```bash
pnpm dlx shadcn@latest add button card input label dialog drop-down-menu badge separator skeleton sonner
```

(If `drop-down-menu` errors, use `dropdown-menu`.)

- [ ] **Step 4.5 — Verify TS still clean**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 4.6 — Commit**

```bash
git add src/components/ui src/lib/utils.ts components.json package.json pnpm-lock.yaml
git commit -m "[infra-agent] feat(ui): shadcn primitives + Framer Motion + cn helper"
```

---

## Task 5: Fonts via `next/font` (Inter, Fraunces, JetBrains Mono)

**Files:** Modify `src/app/layout.tsx`

- [ ] **Step 5.1 — Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "UA Email",
  description: "AI-first universal email client. Triaged in seconds.",
  manifest: "/manifest.webmanifest",
  themeColor: "#0f0f14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable}`}
    >
      <body className="bg-canvas text-textPrimary antialiased">
        {children}
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
```

- [ ] **Step 5.2 — Verify build + dev server**

```bash
pnpm build
pnpm dev
```

Open http://localhost:3000 → page renders dark background. Stop dev server with Ctrl+C.

- [ ] **Step 5.3 — Commit**

```bash
git add src/app/layout.tsx
git commit -m "[infra-agent] feat(fonts): Inter + Fraunces + JetBrains Mono via next/font"
```

---

## Task 6: `CLAUDE.md` — repo guide for every agent session

**Files:** Create `CLAUDE.md`

- [ ] **Step 6.1 — Create `CLAUDE.md` at repo root**

```markdown
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
```

- [ ] **Step 6.2 — Commit**

```bash
git add CLAUDE.md
git commit -m "[infra-agent] docs: add CLAUDE.md as the repo contract for all agents"
```

---

## Task 7: `.claude/settings.json` — hooks + permissions

**Files:** Create `.claude/settings.json`, extend `.gitignore`

- [ ] **Step 7.1 — Create `.claude/settings.json`**

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm install)",
      "Bash(pnpm add:*)",
      "Bash(pnpm exec tsc:*)",
      "Bash(pnpm lint:*)",
      "Bash(pnpm test:*)",
      "Bash(pnpm dev)",
      "Bash(pnpm build)",
      "Bash(pnpm dlx:*)",
      "Bash(git status)",
      "Bash(git diff:*)",
      "Bash(git add:*)",
      "Bash(git log:*)",
      "Bash(git commit:*)",
      "Bash(git branch:*)",
      "Bash(git checkout:*)",
      "Bash(git worktree:*)",
      "Bash(vercel:*)",
      "Bash(npx playwright:*)"
    ],
    "deny": [
      "Bash(rm -rf /:*)",
      "Bash(git push --force:*)",
      "Bash(git reset --hard origin/*:*)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'if git diff --cached --name-only 2>/dev/null | grep -E \"(^|/)\\.env(\\.|$)\" >/dev/null; then echo \"BLOCKED: .env file staged for commit\" >&2; exit 2; fi; exit 0'"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'f=\"$CLAUDE_FILE_PATH\"; if [[ \"$f\" =~ \\.(ts|tsx|js|jsx|json|md|css)$ ]] && [[ -f \"$f\" ]]; then pnpm exec prettier --write \"$f\" 2>/dev/null || true; fi'"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'mkdir -p .superpowers && echo \"$(date -u +%FT%TZ) subagent-stop\" >> .superpowers/agent-log'"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'mkdir -p .superpowers && echo \"$(date -u +%FT%TZ) session-stop\" >> .superpowers/agent-log'"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 7.2 — Add `.claude/settings.local.json` to `.gitignore`**

Append to `.gitignore`:

```gitignore
.claude/settings.local.json
```

- [ ] **Step 7.3 — Commit**

```bash
git add .claude/settings.json .gitignore
git commit -m "[infra-agent] chore(claude): hooks + allowlist + agent log + secret-leak guard"
```

---

## Task 8: `.env.example` + env type contract

**Files:** Create `.env.example`, `src/lib/env.ts`

- [ ] **Step 8.1 — Create `.env.example`**

```bash
# === LLM providers (server-side only) ===
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=...

# Which LLM to use by default. anthropic | openai | gemini
DEFAULT_LLM_PROVIDER=anthropic

# === OAuth (test-mode for v1) ===
AUTH_SECRET=                # generate with: openssl rand -base64 32
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_MICROSOFT_ID=
AUTH_MICROSOFT_SECRET=
AUTH_MICROSOFT_TENANT_ID=common

# === Public URL (Vercel sets this at deploy time) ===
NEXTAUTH_URL=http://localhost:3000
```

- [ ] **Step 8.2 — Install Zod**

```bash
pnpm add zod
```

- [ ] **Step 8.3 — Create `src/lib/env.ts` with parsed + typed env**

```ts
import { z } from "zod";

const envSchema = z.object({
  // LLM
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  GOOGLE_AI_API_KEY: z.string().min(1).optional(),
  DEFAULT_LLM_PROVIDER: z.enum(["anthropic", "openai", "gemini"]).default("anthropic"),

  // Auth
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  AUTH_MICROSOFT_ID: z.string().min(1).optional(),
  AUTH_MICROSOFT_SECRET: z.string().min(1).optional(),
  AUTH_MICROSOFT_TENANT_ID: z.string().default("common"),

  NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
```

- [ ] **Step 8.4 — Verify typecheck**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 8.5 — Commit**

```bash
git add .env.example src/lib/env.ts package.json pnpm-lock.yaml
git commit -m "[infra-agent] feat(env): Zod-parsed env schema + .env.example"
```

---

## Task 9: Vitest + first unit smoke test

**Files:** Create `vitest.config.ts`, `tests/unit/smoke.test.ts`

- [ ] **Step 9.1 — Install Vitest + Testing Library**

```bash
pnpm add -D vitest @vitejs/plugin-react happy-dom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 9.2 — Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/components/**"],
      exclude: ["**/*.d.ts", "**/types/**"],
      reporter: ["text", "json-summary"],
    },
  },
});
```

- [ ] **Step 9.3 — Write the failing smoke test**

Create `tests/unit/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("foundation smoke", () => {
  it("cn merges tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", undefined, "text-blue-500")).toBe("text-blue-500");
  });

  it("env module loads", async () => {
    const { env } = await import("@/lib/env");
    expect(env.DEFAULT_LLM_PROVIDER).toBe("anthropic");
  });
});
```

- [ ] **Step 9.4 — Add test scripts to `package.json`**

Edit `package.json` `scripts` block to include:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:unit:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 9.5 — Run tests**

```bash
pnpm test:unit
```

Expected: both tests pass.

- [ ] **Step 9.6 — Commit**

```bash
git add vitest.config.ts tests/unit/smoke.test.ts package.json pnpm-lock.yaml
git commit -m "[test-agent] test: Vitest config + foundation smoke tests"
```

---

## Task 10: Playwright + first e2e smoke test

**Files:** Create `playwright.config.ts`, `tests/e2e/smoke.spec.ts`

- [ ] **Step 10.1 — Install Playwright + axe-core**

```bash
pnpm add -D @playwright/test @axe-core/playwright
pnpm exec playwright install --with-deps chromium
```

- [ ] **Step 10.2 — Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 10.3 — Write a placeholder failing e2e smoke**

Create `tests/e2e/smoke.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("home page loads and is accessible", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/UA Email/i);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});
```

- [ ] **Step 10.4 — Run (will fail until Task 26 lands; that's fine — capture the baseline)**

```bash
pnpm exec playwright test --project=chromium --reporter=list
```

Expected: test runs, may fail on title (page.tsx still default scaffold). Confirm Playwright itself works.

- [ ] **Step 10.5 — Commit**

```bash
git add playwright.config.ts tests/e2e/smoke.spec.ts package.json pnpm-lock.yaml
git commit -m "[test-agent] test: Playwright config + axe-core smoke (gated until home page lands)"
```

---

## Task 11: MSW for provider mocking

**Files:** Create `tests/mocks/handlers.ts`, `tests/mocks/server.ts`

- [ ] **Step 11.1 — Install MSW**

```bash
pnpm add -D msw@latest
```

- [ ] **Step 11.2 — Create `tests/mocks/handlers.ts`**

```ts
import { http, HttpResponse } from "msw";

/**
 * Phase-1 placeholder handlers. Provider-agent and ai-agent will extend
 * these with realistic Gmail / Graph / IMAP / LLM mock responses.
 */
export const handlers = [
  http.get("https://gmail.googleapis.com/gmail/v1/users/me/messages", () => {
    return HttpResponse.json({ messages: [], nextPageToken: undefined });
  }),
  http.get("https://graph.microsoft.com/v1.0/me/messages", () => {
    return HttpResponse.json({ value: [] });
  }),
  http.post("/api/ai/triage", async () => {
    return HttpResponse.json({ results: [] });
  }),
];
```

- [ ] **Step 11.3 — Create `tests/mocks/server.ts`**

```ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

- [ ] **Step 11.4 — Wire MSW into Vitest setup**

Create `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mocks/server";

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Modify `vitest.config.ts` `test` block:

```ts
test: {
  environment: "happy-dom",
  globals: true,
  setupFiles: ["./tests/setup.ts"],
  include: ["tests/unit/**/*.test.{ts,tsx}"],
  coverage: { /* ...unchanged */ },
},
```

- [ ] **Step 11.5 — Verify tests still pass**

```bash
pnpm test:unit
```

Expected: smoke tests pass, no MSW warnings about unhandled requests.

- [ ] **Step 11.6 — Commit**

```bash
git add tests/mocks tests/setup.ts vitest.config.ts package.json pnpm-lock.yaml
git commit -m "[test-agent] test: MSW provider mocks + Vitest setup"
```

---

## Task 12: GitHub Actions CI

**Files:** Create `.github/workflows/ci.yml`

- [ ] **Step 12.1 — Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [master, main]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Unit tests
        run: pnpm test:unit --coverage

      - name: Build
        run: pnpm build

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: E2E tests
        run: pnpm test:e2e --project=chromium

      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 12.2 — Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "[infra-agent] ci: GitHub Actions — typecheck, lint, unit, build, e2e"
```

---

## Task 13: Core domain types

**Files:** Create `src/lib/types/{message,thread,account,ai}.ts`

- [ ] **Step 13.1 — Create `src/lib/types/account.ts`**

```ts
import { z } from "zod";

export const ProviderId = z.enum(["gmail", "outlook", "imap"]);
export type ProviderId = z.infer<typeof ProviderId>;

export const OAuthTokens = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.number().int(), // unix seconds
  scope: z.string(),
});
export type OAuthTokens = z.infer<typeof OAuthTokens>;

export const ImapCreds = z.object({
  host: z.string(),
  port: z.number().int(),
  secure: z.boolean(),
  user: z.string(),
  pass: z.string(), // app password
});
export type ImapCreds = z.infer<typeof ImapCreds>;

export const Account = z.object({
  id: z.string(), // uuid
  provider: ProviderId,
  email: z.string().email(),
  label: z.string(),
  oauthTokens: OAuthTokens.optional(),
  imapCreds: ImapCreds.optional(),
  lastSyncAt: z.number().int().nullable(),
});
export type Account = z.infer<typeof Account>;
```

- [ ] **Step 13.2 — Create `src/lib/types/message.ts`**

```ts
import { z } from "zod";

export const Bucket = z.enum(["needs_reply", "fyi", "newsletter", "noise"]);
export type Bucket = z.infer<typeof Bucket>;

export const Address = z.object({
  name: z.string().optional(),
  email: z.string().email(),
});
export type Address = z.infer<typeof Address>;

export const Message = z.object({
  id: z.string(),                 // provider-native id, prefixed by accountId
  accountId: z.string(),
  threadId: z.string(),
  from: Address,
  to: z.array(Address),
  cc: z.array(Address).default([]),
  bcc: z.array(Address).default([]),
  subject: z.string(),
  snippet: z.string(),
  body: z.string(),               // text/plain rendering; HTML stored separately if available
  bodyHtml: z.string().optional(),
  receivedAt: z.number().int(),   // unix ms
  labels: z.array(z.string()).default([]),
  flags: z.object({
    unread: z.boolean().default(true),
    starred: z.boolean().default(false),
    archived: z.boolean().default(false),
    trashed: z.boolean().default(false),
  }),
});
export type Message = z.infer<typeof Message>;
```

- [ ] **Step 13.3 — Create `src/lib/types/thread.ts`**

```ts
import { z } from "zod";
import { Address } from "./message";

export const Thread = z.object({
  id: z.string(),
  accountId: z.string(),
  subject: z.string(),
  participants: z.array(Address),
  messageIds: z.array(z.string()),
  updatedAt: z.number().int(),
});
export type Thread = z.infer<typeof Thread>;
```

- [ ] **Step 13.4 — Create `src/lib/types/ai.ts`**

```ts
import { z } from "zod";
import { Bucket } from "./message";

export const AiResult = z.object({
  messageId: z.string(),
  bucket: Bucket,
  summary: z.string().max(140),
  suggestedReply: z.string().max(500).nullable(),
  model: z.string(),
  processedAt: z.number().int(),
  promptCacheHit: z.boolean().default(false),
  version: z.number().int().default(1), // prompt schema version
});
export type AiResult = z.infer<typeof AiResult>;
```

- [ ] **Step 13.5 — Test the types compile**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 13.6 — Commit**

```bash
git add src/lib/types
git commit -m "[infra-agent] feat(types): core domain types (Account, Message, Thread, AiResult) with Zod"
```

---

## Task 14: `MailProvider` interface

**Files:** Create `src/lib/providers/mail-provider.ts`

- [ ] **Step 14.1 — Create `src/lib/providers/mail-provider.ts`**

```ts
import type { Message } from "@/lib/types/message";
import type { Account } from "@/lib/types/account";

export interface Draft {
  to: { email: string; name?: string }[];
  cc?: { email: string; name?: string }[];
  bcc?: { email: string; name?: string }[];
  subject: string;
  body: string;
  inReplyToMessageId?: string;
}

export interface ListResult {
  messages: Message[];
  nextCursor?: string;
}

/**
 * Contract every email backend implements. The unified inbox concatenates
 * across all configured accounts using only this interface.
 *
 * Provider implementations live in `src/lib/providers/<id>/`:
 *   - gmail/gmail-provider.ts
 *   - outlook/outlook-provider.ts
 *   - imap/imap-provider.ts
 */
export interface MailProvider {
  readonly id: "gmail" | "outlook" | "imap";
  readonly account: Account;

  list(opts: { cursor?: string; since?: Date; limit?: number }): Promise<ListResult>;
  get(messageId: string): Promise<Message>;
  send(draft: Draft): Promise<{ messageId: string }>;
  archive(messageId: string): Promise<void>;
  delete(messageId: string): Promise<void>;
  setLabel(messageId: string, label: string, on: boolean): Promise<void>;
  search(query: string): Promise<Message[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly cause: "rate_limit" | "auth" | "network" | "validation" | "unknown",
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
```

- [ ] **Step 14.2 — Verify typecheck**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 14.3 — Commit**

```bash
git add src/lib/providers/mail-provider.ts
git commit -m "[infra-agent] feat(providers): MailProvider interface + ProviderError class"
```

---

## Task 15: `LLMProvider` interface

**Files:** Create `src/lib/ai/llm-provider.ts`

- [ ] **Step 15.1 — Create `src/lib/ai/llm-provider.ts`**

```ts
import type { Message } from "@/lib/types/message";
import type { AiResult } from "@/lib/types/ai";

export interface TriageInput {
  messageId: string;
  from: string;            // "Name <email>"
  subject: string;
  bodyExcerpt: string;     // first ~2000 chars of plain-text body
  receivedAt: number;
}

export interface ReplyContext {
  /** The thread up to (and including) the message being replied to. */
  threadPlaintext: string;
  /** Optional tone hint from the user. */
  tone?: "concise" | "warm" | "formal";
}

/**
 * Pluggable AI backend. Three implementations:
 *   - src/lib/ai/anthropic/anthropic-provider.ts  (default, prompt caching)
 *   - src/lib/ai/openai/openai-provider.ts
 *   - src/lib/ai/gemini/gemini-provider.ts
 *
 * All adapters share prompts from src/lib/ai/prompts.ts.
 * Responses are validated with Zod (AiResult) before returning.
 */
export interface LLMProvider {
  readonly id: "anthropic" | "openai" | "gemini";
  readonly model: string;

  /**
   * Classify a batch of up to N=20 messages in one structured-output call.
   * @returns one AiResult per input, in the same order, with `promptCacheHit`
   *          populated when the underlying provider exposes it.
   */
  triageBatch(emails: TriageInput[]): Promise<AiResult[]>;

  /**
   * On-demand: regenerate / refine a reply for a single message.
   * Used when the user clicks "Suggest a reply" or "Regenerate" in thread view.
   */
  draftReply(email: Message, ctx: ReplyContext): Promise<string>;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly cause: "rate_limit" | "auth" | "schema" | "network" | "unknown",
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "LLMError";
  }
}
```

- [ ] **Step 15.2 — Verify typecheck**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 15.3 — Commit**

```bash
git add src/lib/ai/llm-provider.ts
git commit -m "[infra-agent] feat(ai): LLMProvider interface + LLMError class"
```

---

## Task 16: Dexie schema + database instance

**Files:** Create `src/lib/db/schema.ts`, `src/lib/db/db.ts`

- [ ] **Step 16.1 — Install Dexie**

```bash
pnpm add dexie
```

- [ ] **Step 16.2 — Create `src/lib/db/schema.ts`**

```ts
import type { Account } from "@/lib/types/account";
import type { Message, Bucket } from "@/lib/types/message";
import type { Thread } from "@/lib/types/thread";
import type { AiResult } from "@/lib/types/ai";

/**
 * Dexie table row shapes. Bucket-derived fields are denormalized onto messages
 * for fast inbox queries without join cost.
 */
export interface MessageRow extends Message {
  // Denormalized fields for indexing
  bucket?: Bucket;
  promptCacheHit?: boolean;
  aiProcessedAt?: number;
}

export interface SyncCursor {
  accountId: string;
  providerCursor: string;  // historyId for Gmail/Graph, UIDNEXT for IMAP
  lastFullSyncAt: number;
}

export interface AppSettings {
  id: "singleton";
  llmProvider: "anthropic" | "openai" | "gemini";
  byok: {
    anthropic?: string;
    openai?: string;
    gemini?: string;
  };
  syncIntervalSec: number;
  hardenedMode: boolean;  // when true, tokens encrypted with passphrase
}

export type Tables = {
  accounts: Account;
  messages: MessageRow;
  threads: Thread;
  aiResults: AiResult;
  syncCursors: SyncCursor;
  settings: AppSettings;
};
```

- [ ] **Step 16.3 — Create `src/lib/db/db.ts`**

```ts
import Dexie, { type EntityTable } from "dexie";
import type {
  Tables,
} from "./schema";

class UAEmailDB extends Dexie {
  accounts!: EntityTable<Tables["accounts"], "id">;
  messages!: EntityTable<Tables["messages"], "id">;
  threads!: EntityTable<Tables["threads"], "id">;
  aiResults!: EntityTable<Tables["aiResults"], "messageId">;
  syncCursors!: EntityTable<Tables["syncCursors"], "accountId">;
  settings!: EntityTable<Tables["settings"], "id">;

  constructor() {
    super("ua-email");

    this.version(1).stores({
      accounts: "id, provider, email, lastSyncAt",
      messages:
        "id, accountId, threadId, receivedAt, bucket, [accountId+receivedAt], [accountId+bucket]",
      threads: "id, accountId, updatedAt, [accountId+updatedAt]",
      aiResults: "messageId, processedAt, version",
      syncCursors: "accountId",
      settings: "id",
    });
  }
}

let _db: UAEmailDB | null = null;

/**
 * Lazy singleton. Initialized only in the browser — server-rendered code
 * must not import this module top-level.
 */
export function getDB(): UAEmailDB {
  if (typeof indexedDB === "undefined") {
    throw new Error("getDB() called outside of a browser context");
  }
  if (!_db) _db = new UAEmailDB();
  return _db;
}

/** Test-only: reset the cached instance after wiping data. */
export function _resetDBForTests(): void {
  _db = null;
}
```

- [ ] **Step 16.4 — Verify typecheck**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 16.5 — Commit**

```bash
git add src/lib/db package.json pnpm-lock.yaml
git commit -m "[pwa-agent] feat(db): Dexie schema v1 + lazy DB singleton"
```

---

## Task 17: Tests for Dexie schema (CRUD round-trip)

**Files:** Create `tests/unit/db.test.ts`

- [ ] **Step 17.1 — Install fake-indexeddb for the Node test env**

```bash
pnpm add -D fake-indexeddb
```

- [ ] **Step 17.2 — Update `tests/setup.ts` to install fake-indexeddb**

Replace `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mocks/server";
import { _resetDBForTests } from "@/lib/db/db";

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  server.resetHandlers();
  _resetDBForTests();
});
afterAll(() => server.close());
```

- [ ] **Step 17.3 — Write the failing test**

Create `tests/unit/db.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { getDB } from "@/lib/db/db";
import type { Account } from "@/lib/types/account";
import type { MessageRow } from "@/lib/db/schema";

describe("Dexie schema v1", () => {
  beforeEach(async () => {
    const db = getDB();
    await db.delete();
    await db.open();
  });

  it("persists and reads back an account", async () => {
    const db = getDB();
    const acct: Account = {
      id: "acct-1",
      provider: "gmail",
      email: "shakul@example.com",
      label: "Personal",
      lastSyncAt: null,
    };
    await db.accounts.put(acct);

    const round = await db.accounts.get("acct-1");
    expect(round).toEqual(acct);
  });

  it("indexes messages by [accountId+receivedAt] for chronological inbox", async () => {
    const db = getDB();
    const messages: MessageRow[] = [
      makeMsg("m-1", "acct-1", 1000),
      makeMsg("m-2", "acct-1", 3000),
      makeMsg("m-3", "acct-1", 2000),
    ];
    await db.messages.bulkPut(messages);

    const ordered = await db.messages
      .where("[accountId+receivedAt]")
      .between(["acct-1", 0], ["acct-1", Number.MAX_SAFE_INTEGER])
      .toArray();

    expect(ordered.map((m) => m.id)).toEqual(["m-1", "m-3", "m-2"]);
  });

  it("indexes messages by [accountId+bucket] for triage queries", async () => {
    const db = getDB();
    await db.messages.bulkPut([
      makeMsg("m-1", "acct-1", 1000, "needs_reply"),
      makeMsg("m-2", "acct-1", 2000, "fyi"),
      makeMsg("m-3", "acct-1", 3000, "needs_reply"),
    ]);

    const needsReply = await db.messages
      .where("[accountId+bucket]")
      .equals(["acct-1", "needs_reply"])
      .toArray();

    expect(needsReply.map((m) => m.id).sort()).toEqual(["m-1", "m-3"]);
  });
});

function makeMsg(
  id: string,
  accountId: string,
  receivedAt: number,
  bucket?: "needs_reply" | "fyi" | "newsletter" | "noise",
): MessageRow {
  return {
    id,
    accountId,
    threadId: `t-${id}`,
    from: { email: "x@y.com" },
    to: [{ email: "me@me.com" }],
    cc: [],
    bcc: [],
    subject: "s",
    snippet: "",
    body: "",
    receivedAt,
    labels: [],
    flags: { unread: true, starred: false, archived: false, trashed: false },
    ...(bucket ? { bucket } : {}),
  };
}
```

- [ ] **Step 17.4 — Run the test**

```bash
pnpm test:unit
```

Expected: 3 new tests pass alongside the smoke tests.

- [ ] **Step 17.5 — Commit**

```bash
git add tests/unit/db.test.ts tests/setup.ts package.json pnpm-lock.yaml
git commit -m "[test-agent] test(db): Dexie schema CRUD + composite-index queries"
```

---

## Task 18: Root layout + base shell

(Already wired in Task 5; this task formalizes the metadata + adds the global frame.)

**Files:** Modify `src/app/layout.tsx`

- [ ] **Step 18.1 — Replace `src/app/layout.tsx` with the final shell**

```tsx
import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "UA Email", template: "%s · UA Email" },
  description: "AI-first universal email client. Triaged in seconds.",
  manifest: "/manifest.webmanifest",
  applicationName: "UA Email",
  icons: { icon: "/icon-192.png", apple: "/icon-512.png" },
};

export const viewport: Viewport = {
  themeColor: "#0f0f14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable}`}
    >
      <body className="bg-canvas text-textPrimary antialiased min-h-screen">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">{children}</div>
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
```

- [ ] **Step 18.2 — Verify build + dev**

```bash
pnpm build
```

- [ ] **Step 18.3 — Commit**

```bash
git add src/app/layout.tsx
git commit -m "[ui-agent] feat(shell): final root layout with viewport + container"
```

---

## Task 19: PWA manifest + icons

**Files:** Create `public/manifest.webmanifest`, `public/icon-192.png`, `public/icon-512.png`

- [ ] **Step 19.1 — Create `public/manifest.webmanifest`**

```json
{
  "name": "UA Email",
  "short_name": "UA Email",
  "description": "AI-first universal email client.",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0f0f14",
  "theme_color": "#0f0f14",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 19.2 — Generate placeholder icons (single-color 1x1 PNG scaled by browser)**

```bash
node -e "
const fs = require('fs');
const png = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C636060606060000000050001A1B1C8A30000000049454E44AE426082','hex');
fs.writeFileSync('public/icon-192.png', png);
fs.writeFileSync('public/icon-512.png', png);
console.log('placeholders written');
"
```

(These are tiny 1×1 transparent PNGs. `doc-agent` in Phase 3 will replace them with real artwork. Browsers scale them; they pass manifest validation.)

- [ ] **Step 19.3 — Commit**

```bash
git add public/manifest.webmanifest public/icon-192.png public/icon-512.png
git commit -m "[infra-agent] feat(pwa): manifest + placeholder icons"
```

---

## Task 20: next-pwa service worker

**Files:** Modify `next.config.mjs`

- [ ] **Step 20.1 — Install next-pwa**

```bash
pnpm add @ducanh2912/next-pwa
```

- [ ] **Step 20.2 — Update `next.config.mjs`**

```js
import withPWA from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { typedRoutes: true },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      {
        urlPattern: ({ request }) => request.destination === "document",
        handler: "NetworkFirst",
        options: { cacheName: "html", networkTimeoutSeconds: 3 },
      },
      {
        urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
        handler: "NetworkOnly",
      },
    ],
  },
})(nextConfig);
```

- [ ] **Step 20.3 — Verify build emits sw.js**

```bash
pnpm build
ls public/sw.js 2>/dev/null && echo "service worker generated" || echo "MISSING"
```

Expected: `service worker generated`.

- [ ] **Step 20.4 — Add `public/sw.js`-like artifacts to .gitignore**

Append to `.gitignore`:

```gitignore
public/sw.js
public/workbox-*.js
public/worker-*.js
public/fallback-*.js
```

- [ ] **Step 20.5 — Commit**

```bash
git add next.config.mjs .gitignore package.json pnpm-lock.yaml
git commit -m "[pwa-agent] feat(pwa): next-pwa service worker with NetworkFirst doc cache"
```

---

## Task 21: `/api/auth/[...nextauth]` — Auth.js scaffold

**Files:** Create `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 21.1 — Install Auth.js v5**

```bash
pnpm add next-auth@beta @auth/core
```

- [ ] **Step 21.2 — Create `src/lib/auth.ts`**

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Microsoft from "next-auth/providers/microsoft-entra-id";
import { env } from "@/lib/env";

const providers = [];

if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  );
}

if (env.AUTH_MICROSOFT_ID && env.AUTH_MICROSOFT_SECRET) {
  providers.push(
    Microsoft({
      clientId: env.AUTH_MICROSOFT_ID,
      clientSecret: env.AUTH_MICROSOFT_SECRET,
      issuer: `https://login.microsoftonline.com/${env.AUTH_MICROSOFT_TENANT_ID}/v2.0`,
      authorization: {
        params: {
          scope: "openid email profile offline_access Mail.ReadWrite Mail.Send User.Read",
        },
      },
    }),
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  trustHost: true,
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.providerId = account.provider;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      // Tokens are NOT exposed via session — they're fetched via /api/auth/handoff
      session.user = { ...session.user, providerId: token.providerId as string };
      return session;
    },
  },
});
```

- [ ] **Step 21.3 — Create `src/app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 21.4 — Verify build (env-less mode — providers list will be empty, which is fine)**

```bash
pnpm build
```

- [ ] **Step 21.5 — Commit**

```bash
git add src/lib/auth.ts src/app/api/auth package.json pnpm-lock.yaml
git commit -m "[provider-agent] feat(auth): Auth.js v5 scaffold with Google + Microsoft (test-mode scopes)"
```

---

## Task 22: `/api/auth/handoff` — one-shot token transfer

**Files:** Create `src/app/api/auth/handoff/route.ts`

- [ ] **Step 22.1 — Create the handoff route**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";

/**
 * Browser calls this once after OAuth completes. The route reads the
 * Auth.js session, returns the access/refresh tokens to the browser,
 * then clears the session cookie. After this call the server holds nothing.
 *
 * Phase-1 STUB: returns 501 until provider-agent wires real session token
 * extraction in the per-provider implementation phase.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  // STUB: real token extraction lands with provider-agent in Phase 2.
  // The Auth.js session itself doesn't expose tokens by default — we use
  // a custom JWT callback to surface them safely.

  const c = await cookies();
  // Clear all auth cookies so server holds nothing.
  for (const cookie of c.getAll()) {
    if (cookie.name.startsWith("authjs.") || cookie.name.startsWith("__Secure-authjs.")) {
      c.delete(cookie.name);
    }
  }

  return NextResponse.json(
    { error: "stub_not_implemented", message: "Handoff implementation lands in provider-agent phase." },
    { status: 501 },
  );
}
```

- [ ] **Step 22.2 — Verify build**

```bash
pnpm build
```

- [ ] **Step 22.3 — Commit**

```bash
git add src/app/api/auth/handoff
git commit -m "[provider-agent] feat(auth): /api/auth/handoff stub (501 until token plumbing lands)"
```

---

## Task 23: `/api/imap` stub

**Files:** Create `src/app/api/imap/route.ts`

- [ ] **Step 23.1 — Create the route**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * IMAP proxy. Browser cannot speak raw TCP, so this endpoint relays IMAP
 * commands to the user's chosen server using ImapFlow.
 *
 * Phase-1 STUB: validates the request shape only. ImapFlow integration
 * lands with provider-agent.
 */

const ImapRequest = z.discriminatedUnion("op", [
  z.object({ op: z.literal("list"), accountId: z.string(), cursor: z.string().optional() }),
  z.object({ op: z.literal("get"), accountId: z.string(), uid: z.number().int() }),
  z.object({ op: z.literal("send"), accountId: z.string(), rfc822: z.string() }),
  z.object({ op: z.literal("flag"), accountId: z.string(), uid: z.number().int(), flag: z.string(), on: z.boolean() }),
]);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ImapRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
  }

  return NextResponse.json(
    { error: "stub_not_implemented", op: parsed.data.op },
    { status: 501 },
  );
}
```

- [ ] **Step 23.2 — Verify build**

```bash
pnpm build
```

- [ ] **Step 23.3 — Commit**

```bash
git add src/app/api/imap
git commit -m "[provider-agent] feat(imap): /api/imap stub with Zod request validation"
```

---

## Task 24: `/api/ai/triage` stub

**Files:** Create `src/app/api/ai/triage/route.ts`

- [ ] **Step 24.1 — Create the route**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { Bucket } from "@/lib/types/message";

const TriageRequest = z.object({
  provider: z.enum(["anthropic", "openai", "gemini"]).optional(),
  byok: z.string().optional(),
  emails: z
    .array(
      z.object({
        messageId: z.string(),
        from: z.string(),
        subject: z.string(),
        bodyExcerpt: z.string().max(8000),
        receivedAt: z.number().int(),
      }),
    )
    .min(1)
    .max(20),
});

const TriageResult = z.object({
  messageId: z.string(),
  bucket: Bucket,
  summary: z.string().max(140),
  suggestedReply: z.string().max(500).nullable(),
});

const TriageResponse = z.object({
  results: z.array(TriageResult),
  model: z.string(),
  promptCacheHit: z.boolean(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = TriageRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
  }

  // STUB: real LLM call lands with ai-agent. Phase-1 returns an empty
  // result set so the sync engine can run end-to-end against the stub.
  const stub: z.infer<typeof TriageResponse> = {
    results: parsed.data.emails.map((e) => ({
      messageId: e.messageId,
      bucket: "fyi" as const,
      summary: "(triage pending — AI not wired in this build)",
      suggestedReply: null,
    })),
    model: "stub",
    promptCacheHit: false,
  };

  return NextResponse.json(stub);
}
```

- [ ] **Step 24.2 — Verify build**

```bash
pnpm build
```

- [ ] **Step 24.3 — Commit**

```bash
git add src/app/api/ai
git commit -m "[ai-agent] feat(ai): /api/ai/triage stub with Zod request/response validation"
```

---

## Task 25: `AccountSwitcher` shell

**Files:** Create `src/components/account-switcher.tsx`

- [ ] **Step 25.1 — Create the component shell**

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  /** Phase-2 plugs in real accounts from Dexie. */
  accounts?: { id: string; email: string; label: string }[];
  activeAccountId?: string | "unified";
  onChange?: (id: string | "unified") => void;
}

export function AccountSwitcher({ accounts = [], activeAccountId = "unified", onChange }: Props) {
  const [open, setOpen] = useState(false);
  const active =
    activeAccountId === "unified"
      ? { id: "unified", email: "All accounts", label: "Unified Inbox" }
      : accounts.find((a) => a.id === activeAccountId);

  return (
    <div className="relative inline-block">
      <Button
        variant="ghost"
        className="gap-2 text-textPrimary"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Inbox className="h-4 w-4 text-aiAccent" aria-hidden />
        <span className="font-display italic text-lg">{active?.label ?? "No account"}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <motion.ul
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          role="listbox"
          className="absolute left-0 top-full z-10 mt-2 w-72 rounded-drawer border border-cardBorder bg-card backdrop-blur-card p-1"
        >
          <SwitcherItem label="Unified Inbox" sub="All accounts" onClick={() => { onChange?.("unified"); setOpen(false); }} active={activeAccountId === "unified"} />
          {accounts.map((a) => (
            <SwitcherItem key={a.id} label={a.label} sub={a.email} onClick={() => { onChange?.(a.id); setOpen(false); }} active={a.id === activeAccountId} />
          ))}
          <li className="mt-1 border-t border-cardBorder pt-1">
            <button className="flex w-full items-center gap-2 rounded-card px-3 py-2 text-sm text-aiAccent hover:bg-white/5">
              <Plus className="h-4 w-4" />
              Add account
            </button>
          </li>
        </motion.ul>
      )}
    </div>
  );
}

function SwitcherItem({ label, sub, active, onClick }: { label: string; sub: string; active?: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        role="option"
        aria-selected={active}
        className={cn(
          "flex w-full flex-col items-start rounded-card px-3 py-2 text-left transition-colors hover:bg-white/5",
          active && "bg-white/5",
        )}
      >
        <span className="text-sm text-textPrimary">{label}</span>
        <span className="text-xs text-textMuted">{sub}</span>
      </button>
    </li>
  );
}
```

- [ ] **Step 25.2 — Verify typecheck + build**

```bash
pnpm typecheck && pnpm build
```

- [ ] **Step 25.3 — Commit**

```bash
git add src/components/account-switcher.tsx
git commit -m "[ui-agent] feat(ui): AccountSwitcher shell with motion + a11y roles"
```

---

## Task 26: `TriagedInboxView` shell + home page

**Files:** Create `src/components/triaged-inbox-view.tsx`, replace `src/app/page.tsx`

- [ ] **Step 26.1 — Create `src/components/triaged-inbox-view.tsx`**

```tsx
"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { motion as motionTokens } from "@/styles/motion-tokens";

const BUCKETS = [
  { id: "needs_reply", label: "Needs reply", color: "text-bucket-needsReply" },
  { id: "fyi", label: "FYI", color: "text-bucket-fyi" },
  { id: "newsletter", label: "Newsletters", color: "text-bucket-newsletter" },
  { id: "noise", label: "Noise", color: "text-bucket-noise" },
] as const;

/**
 * Phase-1: empty-state shell. Each bucket renders with a skeleton card
 * to communicate that the AI pipeline runs here once Phase 2 wires it.
 */
export function TriagedInboxView({ loading = true }: { loading?: boolean }) {
  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-textPrimary">Your inbox, triaged</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-textMuted">
            <Sparkles className="h-3.5 w-3.5 text-aiAccent" aria-hidden />
            <span>Add an account to begin.</span>
          </p>
        </div>
      </header>

      <div className="space-y-6">
        {BUCKETS.map((b, i) => (
          <motion.section
            key={b.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: motionTokens.duration.base, delay: i * 0.04, ease: motionTokens.ease.out }}
            aria-labelledby={`bucket-${b.id}`}
          >
            <h2
              id={`bucket-${b.id}`}
              className={cn("mb-2 text-xs uppercase tracking-[2px]", b.color)}
            >
              — {b.label}
            </h2>
            <div className="space-y-2">
              {loading ? (
                <>
                  <Skeleton className="h-20 w-full rounded-card bg-card" />
                  <Skeleton className="h-20 w-full rounded-card bg-card opacity-60" />
                </>
              ) : (
                <p className="text-sm text-textMuted">No mail in this bucket yet.</p>
              )}
            </div>
          </motion.section>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 26.2 — Replace `src/app/page.tsx`**

```tsx
import { AccountSwitcher } from "@/components/account-switcher";
import { TriagedInboxView } from "@/components/triaged-inbox-view";

export default function HomePage() {
  return (
    <main className="space-y-8">
      <div className="flex items-center justify-between">
        <AccountSwitcher />
      </div>
      <TriagedInboxView loading />
    </main>
  );
}
```

- [ ] **Step 26.3 — Build + dev smoke**

```bash
pnpm build
pnpm dev
```

Open http://localhost:3000 → confirm:
- Dark canvas, italic "Your inbox, triaged" headline in Fraunces.
- Four bucket sections with skeleton cards.
- AccountSwitcher button renders.

Stop dev with Ctrl+C.

- [ ] **Step 26.4 — Commit**

```bash
git add src/components/triaged-inbox-view.tsx src/app/page.tsx
git commit -m "[ui-agent] feat(home): TriagedInboxView empty-state shell with motion + a11y headings"
```

---

## Task 27: Expand Playwright smoke test against the real home page

**Files:** Modify `tests/e2e/smoke.spec.ts`

- [ ] **Step 27.1 — Replace `tests/e2e/smoke.spec.ts`**

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("home page foundation", () => {
  test("renders the triaged-inbox shell with all four buckets", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/UA Email/i);
    await expect(page.getByRole("heading", { name: /Your inbox, triaged/i })).toBeVisible();

    for (const bucket of ["Needs reply", "FYI", "Newsletters", "Noise"]) {
      await expect(page.getByRole("heading", { name: bucket, level: 2 })).toBeVisible();
    }
  });

  test("has zero accessibility violations on home (axe-core)", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("AccountSwitcher opens a listbox when clicked", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Unified Inbox/i }).click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await expect(page.getByRole("option", { name: /Unified Inbox/i })).toBeVisible();
  });
});
```

- [ ] **Step 27.2 — Run e2e tests**

```bash
pnpm test:e2e --project=chromium
```

Expected: 3 tests pass.

- [ ] **Step 27.3 — Commit**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "[test-agent] test(e2e): home shell tests + zero-axe-violations gate"
```

---

## Task 28: Run the full local verification gauntlet

**Files:** none

- [ ] **Step 28.1 — Run the full pipeline**

```bash
pnpm typecheck
pnpm lint
pnpm test:unit --coverage
pnpm build
pnpm test:e2e --project=chromium
```

Expected: every command exits 0.

- [ ] **Step 28.2 — If anything fails, fix it and re-run before continuing**

Treat this as a real gate, not a formality. Phase 2 starts from a green baseline or it doesn't start.

- [ ] **Step 28.3 — Commit any fixes from Step 28.2**

```bash
git status
# If anything changed:
git add <changed-files>
git commit -m "[infra-agent] fix: address verification gauntlet findings"
```

---

## Task 29: `vercel.json` + preview deploy

**Files:** Create `vercel.json`

- [ ] **Step 29.1 — Create `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install --frozen-lockfile",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    },
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "no-store, no-cache, must-revalidate" }
      ]
    }
  ]
}
```

- [ ] **Step 29.2 — Deploy to Vercel preview**

```bash
pnpm dlx vercel@latest --confirm
# If first time: follow the prompts to create a free account / link the project.
# Choose: New Project → name: ua-email → framework: Next.js (auto-detected)
```

Capture the preview URL.

- [ ] **Step 29.3 — Smoke-test the preview URL manually**

Open the preview URL in a browser. Verify:
- Page loads with dark canvas.
- Headline reads "Your inbox, triaged" in italic Fraunces.
- Four bucket sections visible.
- AccountSwitcher button is clickable.
- Install-as-app prompt is offered in Chrome (3-dot menu → Install).
- `View Source` shows `<link rel="manifest" href="/manifest.webmanifest">`.

- [ ] **Step 29.4 — Commit**

```bash
git add vercel.json
git commit -m "[ship-agent] chore(deploy): vercel.json + security headers"
```

---

## Task 30: README placeholder + capture the live URL

**Files:** Create `README.md`

- [ ] **Step 30.1 — Create `README.md`**

```markdown
# UA Email · Universal AI-First Email Client

> **Live demo:** <PASTE_VERCEL_URL_HERE>
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
```

- [ ] **Step 30.2 — After deploying in Task 29, paste the Vercel URL into the placeholder**

Edit `README.md` line containing `<PASTE_VERCEL_URL_HERE>` with the real URL.

- [ ] **Step 30.3 — Commit**

```bash
git add README.md
git commit -m "[doc-agent] docs(readme): placeholder README with live URL (Phase 3 will replace)"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Covered by |
|---|---|
| §1 Product summary | Task 6 (CLAUDE.md), Task 30 (README) |
| §2 Five principles | Task 6 (CLAUDE.md captures all five verbatim) |
| §3 Three-tier architecture | Tasks 21–24 (Tier 2 stubs), Tasks 16–17 (Tier 1 store), Task 1+18 (Tier 1 shell) |
| §4 Data model | Tasks 13, 16, 17 |
| §5 MailProvider interface | Task 14 |
| §6 LLMProvider interface | Task 15 |
| §7 UI surfaces | Tasks 25, 26 (shells only — full implementations in `ui-screens-plan`) |
| §8 Aesthetic | Tasks 3, 4, 5, 26 |
| §9 Sync engine | Deferred to `pwa-sync-plan` |
| §10 Failure modes | Stubs validate inputs (Tasks 22–24); full handling in per-subsystem plans |
| §11 Multi-agent workflow | CLAUDE.md (Task 6), commit prefixes throughout |
| §12 Testing strategy | Tasks 9, 10, 11, 17, 27 |
| §13 PWA features | Tasks 19, 20 |
| §14 Auth flows | Task 21 (Auth.js scaffold), Task 22 (handoff stub) |
| §15 Scale story | Documented in spec; referenced in CLAUDE.md (Task 6) |
| §16 Evidence package | Coverage metric (Task 9, CI Task 12), a11y zero-violations gate (Task 10/27), agent log (Task 7), remaining items deferred to Phase 3 |
| §17 Deliverables checklist | Foundation plan now exists (this file); CLAUDE.md (Task 6); README (Task 30); architecture/workflow docs deferred to Phase 3 |
| §18 Risks | Mitigations captured in spec + .env.example warns about OAuth setup |

Gaps deliberately deferred to subsequent plans (one per Phase 2 agent):
- Real provider implementations → `provider-plan`
- Service worker offline strategy + sync engine → `pwa-sync-plan`
- LLM adapter implementations + prompts + prompt caching → `ai-pipeline-plan`
- Inbox/thread/compose/search/settings full implementations → `ui-screens-plan`
- Review + docs + demo video + final ship → `polish-ship-plan`

**2. Placeholder scan:** Searched plan for "TBD", "TODO", "implement later", "Add appropriate", "Similar to Task". The word "STUB" appears intentionally in Tasks 22, 23, 24 — those are explicit, documented endpoints that return 501 with a clear handoff comment to the Phase 2 agent. Not placeholders, contracts.

**3. Type consistency:** `MailProvider`, `LLMProvider`, `Message`, `Account`, `AiResult`, `MessageRow`, `Bucket` — all defined once (Tasks 13–17), referenced by name only in later tasks. The Dexie schema (Task 16) extends `Message` to `MessageRow` for denormalized index fields; that's the only type-shape transformation and it's explicit.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-14-foundation-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task (or per logical task cluster), review between tasks, fast iteration with isolated context. Good when tasks are short and you want clean separation.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints for your review. Good when you want to watch live and intervene quickly.

**Which approach?**
