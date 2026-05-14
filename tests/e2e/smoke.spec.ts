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
