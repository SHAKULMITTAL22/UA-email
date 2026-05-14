import type { Account } from "@/lib/types/account";
import type { MessageRow } from "@/lib/db/schema";
import type { AiResult } from "@/lib/types/ai";

export const DEMO_ACCOUNT_ID = "demo-account";

export const DEMO_ACCOUNT: Account = {
  id: DEMO_ACCOUNT_ID,
  provider: "imap",
  email: "demo@ua-email.dev",
  label: "Demo Inbox",
  imapCreds: { host: "demo", port: 0, secure: false, user: "demo", pass: "demo" },
  lastSyncAt: Date.now(),
};

interface SeedSpec {
  from: { name: string; email: string };
  subject: string;
  body: string;
  bucket: "needs_reply" | "fyi" | "newsletter" | "noise";
  summary: string;
  suggestedReply: string | null;
  minutesAgo: number;
}

const SEEDS: SeedSpec[] = [
  {
    from: { name: "Sarah Chen", email: "sarah@acmecorp.com" },
    subject: "Re: Q3 vendor contract — one open question",
    body: "Hey,\n\nThanks for sending over the Q3 vendor contract draft. Pricing looks right, but I noticed the NDA clause from our last discussion isn't in there. Can you confirm before EOD Friday so we can countersign Monday?\n\nThanks,\nSarah",
    bucket: "needs_reply",
    summary: "Sarah needs you to confirm the NDA clause is in the Q3 contract before Friday EOD.",
    suggestedReply: "Hi Sarah — good catch. I'll get the NDA clause added and resend tonight so you have it by morning Friday.",
    minutesAgo: 18,
  },
  {
    from: { name: "Jamie Park", email: "jamie@designstudio.io" },
    subject: "Quick favor — feedback on the new landing?",
    body: "Hey! We're shipping the new landing page Thursday and I'd love your eyes on the hero section before we lock it. 30 seconds is fine. Link: https://figma.com/...",
    bucket: "needs_reply",
    summary: "Jamie wants 30-second feedback on the new landing page hero before Thursday's ship.",
    suggestedReply: "Will take a look this afternoon and ping you with thoughts.",
    minutesAgo: 47,
  },
  {
    from: { name: "Alex Rivera", email: "alex@startup.co" },
    subject: "Are you free for a 20-min call tomorrow?",
    body: "Hey — would love to catch up properly about the partnership opportunity we discussed last week. I have openings 2pm or 4pm tomorrow. Either work?",
    bucket: "needs_reply",
    summary: "Alex is asking if 2pm or 4pm tomorrow works for a 20-minute partnership call.",
    suggestedReply: "2pm works — I'll send a Google Meet link.",
    minutesAgo: 122,
  },
  {
    from: { name: "GitHub", email: "noreply@github.com" },
    subject: "[shakulmittal22/ua-email] PR #14 merged into master",
    body: "Your pull request #14 (\"feat(sync): idle-driven sync loop\") was successfully merged into master by shakulmittal22.\n\n23 files changed · 1,247 additions · 184 deletions",
    bucket: "fyi",
    summary: "PR #14 (sync loop) merged into master — 23 files, +1247/-184.",
    suggestedReply: null,
    minutesAgo: 215,
  },
  {
    from: { name: "Vercel", email: "noreply@vercel.com" },
    subject: "Deployment ready — ua-email-pee0qzfyj-shakulmittal22s-projects.vercel.app",
    body: "Your production deployment is live.\n\nBuild time: 47s · Status: Ready · Region: iad1",
    bucket: "fyi",
    summary: "Production deployment is live; build took 47s.",
    suggestedReply: null,
    minutesAgo: 240,
  },
  {
    from: { name: "Linear", email: "notifications@linear.app" },
    subject: "5 issues moved to In Review this morning",
    body: "Five issues you're following moved into the 'In Review' state on the UA-Email project board.",
    bucket: "fyi",
    summary: "5 issues you follow moved into In Review this morning.",
    suggestedReply: null,
    minutesAgo: 360,
  },
  {
    from: { name: "Stratechery by Ben Thompson", email: "ben@stratechery.com" },
    subject: "The Disruption of Aggregation Theory",
    body: "Aggregation Theory described the dominant business strategy of the past two decades. But the AI-first era is rewriting the playbook. In this issue: how three companies are quietly building moats around model access, not user attention...",
    bucket: "newsletter",
    summary: "Ben Thompson on how AI-era moats form around model access, not user attention.",
    suggestedReply: null,
    minutesAgo: 480,
  },
  {
    from: { name: "Product Hunt", email: "digest@producthunt.com" },
    subject: "Today's top launches — AI email, 3D modeling, and more",
    body: "5 standout launches today including a new AI email triage app (sound familiar?), a no-code 3D modeler, and a privacy-first analytics tool.",
    bucket: "newsletter",
    summary: "Daily Product Hunt digest — including another AI email app launch.",
    suggestedReply: null,
    minutesAgo: 600,
  },
  {
    from: { name: "Lenny's Newsletter", email: "lenny@substack.com" },
    subject: "How great PMs run user interviews (with templates)",
    body: "Drawing from 50+ interviews with top product leaders, here's the framework I now use for every user interview — plus 3 templates you can copy.",
    bucket: "newsletter",
    summary: "Lenny on running user interviews — framework + 3 copy-paste templates.",
    suggestedReply: null,
    minutesAgo: 720,
  },
  {
    from: { name: "CircleCI", email: "noreply@circleci.com" },
    subject: "[FAILED] build #4827 on master — ua-email",
    body: "Build #4827 failed at step 'pnpm test:unit'. View logs at https://circleci.com/...",
    bucket: "noise",
    summary: "CircleCI build #4827 failed at unit test step.",
    suggestedReply: null,
    minutesAgo: 840,
  },
  {
    from: { name: "LinkedIn", email: "messages-noreply@linkedin.com" },
    subject: "Your search appearances this week",
    body: "You appeared in 23 searches this week. Click to see who's been looking.",
    bucket: "noise",
    summary: "LinkedIn weekly search-appearances notification.",
    suggestedReply: null,
    minutesAgo: 1080,
  },
  {
    from: { name: "Notion", email: "team@mail.notion.so" },
    subject: "Reminder: Your trial expires in 7 days",
    body: "Your Notion AI trial expires in 7 days. Upgrade to keep AI features.",
    bucket: "noise",
    summary: "Notion AI trial expires in 7 days.",
    suggestedReply: null,
    minutesAgo: 1440,
  },
];

export function buildSeedRecords(): { messages: MessageRow[]; aiResults: AiResult[] } {
  const now = Date.now();
  const messages: MessageRow[] = [];
  const aiResults: AiResult[] = [];

  SEEDS.forEach((s, i) => {
    const id = `${DEMO_ACCOUNT_ID}:demo-${i + 1}`;
    const receivedAt = now - s.minutesAgo * 60_000;
    messages.push({
      id,
      accountId: DEMO_ACCOUNT_ID,
      threadId: `${DEMO_ACCOUNT_ID}:thread-${i + 1}`,
      from: s.from,
      to: [{ email: "you@example.com" }],
      cc: [],
      bcc: [],
      subject: s.subject,
      snippet: s.summary,
      body: s.body,
      receivedAt,
      labels: [],
      flags: { unread: i < 6, starred: false, archived: false, trashed: false },
      bucket: s.bucket,
      aiProcessedAt: receivedAt,
      promptCacheHit: i > 0,
    });
    aiResults.push({
      messageId: id,
      bucket: s.bucket,
      summary: s.summary,
      suggestedReply: s.suggestedReply,
      model: "demo",
      processedAt: receivedAt,
      promptCacheHit: i > 0,
      version: 1,
    });
  });

  return { messages, aiResults };
}
