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

    // On mobile the sidebar lives behind a hamburger menu.
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 1024) {
      await page.getByRole("button", { name: /Open menu/i }).click();
    }

    const sidebar = page.getByRole("navigation", { name: /Filters/i }).first();
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("button", { name: /Unified Inbox/i })).toBeVisible();
    await expect(sidebar.getByRole("button", { name: /Needs reply/i })).toBeVisible();

    const accountsNav = page.getByRole("navigation", { name: /Accounts/i }).first();
    await expect(accountsNav.getByRole("button", { name: /All accounts/i })).toBeVisible();
  });
});
