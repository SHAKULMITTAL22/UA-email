import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("home page loads and is accessible", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/UA Email/i);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});
