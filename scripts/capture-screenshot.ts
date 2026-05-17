/**
 * Captures the hero screenshot for the README. Runs against the LIVE production
 * Vercel URL — no local dev server required.
 *
 * Output: docs/hero.png (1440x900, the triaged inbox loaded with demo data).
 *
 * Override with $env:HERO_BASE_URL to capture from a different deployment.
 */
import { chromium } from "@playwright/test";

const BASE_URL = process.env["HERO_BASE_URL"] ?? "https://ua-email.vercel.app";

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // ?demo=auto seeds the demo inbox into THIS browser session's IndexedDB
  // on mount, then strips the query string. No setup, no API keys.
  console.log(`[hero] navigating to ${BASE_URL}/?demo=auto ...`);
  await page.goto(`${BASE_URL}/?demo=auto`, { waitUntil: "networkidle" });

  // Wait for the bucket headings + at least a couple of triage cards to paint.
  await page
    .getByRole("heading", { name: /Needs reply|FYI|Newsletters|Noise/i })
    .first()
    .waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1200); // let the FLIP entry animation settle

  await page.screenshot({ path: "docs/hero.png", fullPage: false });
  console.log("[hero] captured: docs/hero.png");

  await browser.close();
}

main().catch((err: unknown) => {
  console.error("[hero] FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
