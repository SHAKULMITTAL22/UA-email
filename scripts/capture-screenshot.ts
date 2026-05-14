import { chromium } from "@playwright/test";

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto("http://localhost:3000/settings");
  await page.getByRole("button", { name: /Load demo inbox/i }).click();
  await page.waitForTimeout(500);

  await page.goto("http://localhost:3000/");
  await page.waitForTimeout(1500);

  await page.screenshot({ path: "docs/hero.png", fullPage: false });
  // eslint-disable-next-line no-console
  console.log("captured: docs/hero.png");

  await browser.close();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
