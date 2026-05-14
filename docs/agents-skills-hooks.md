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
