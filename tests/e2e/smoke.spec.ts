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

  test("sidebar exposes filter buckets and account list", async ({ page }) => {
    await page.goto("/");
    // Desktop sidebar is visible at >=1024px viewports
    const sidebar = page.getByRole("navigation", { name: /Filters/i });
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("button", { name: /Unified Inbox/i })).toBeVisible();
    await expect(sidebar.getByRole("button", { name: /Needs reply/i })).toBeVisible();

    const accountsNav = page.getByRole("navigation", { name: /Accounts/i });
    await expect(accountsNav.getByRole("button", { name: /All accounts/i })).toBeVisible();
  });
});
