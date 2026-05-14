import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("compose button opens drawer", async ({ page }) => {
    await page.goto("/");
    // Both desktop sidebar and mobile top bar expose a Compose control.
    await page.getByRole("button", { name: /Compose/i }).first().click();
    const dialog = page.getByRole("dialog", { name: /New message/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("To")).toBeVisible();
    await expect(dialog.getByLabel("Subject")).toBeVisible();
  });

  test("settings link navigates to settings page", async ({ page }) => {
    await page.goto("/");

    // On mobile the sidebar lives behind a hamburger menu.
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 1024) {
      await page.getByRole("button", { name: /Open menu/i }).click();
    }

    await page.locator('a[href="/settings"]:visible').first().click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole("heading", { name: /Settings/i, level: 1 })).toBeVisible();
    await expect(page.getByText(/Active LLM/i)).toBeVisible();
  });

  test("search bar accepts input", async ({ page }) => {
    await page.goto("/");
    const input = page.getByLabel(/Search messages/i);
    await input.fill("bucket:needs_reply");
    await expect(input).toHaveValue("bucket:needs_reply");
  });
});
