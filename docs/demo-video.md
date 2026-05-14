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
