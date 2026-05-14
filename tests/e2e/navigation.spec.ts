import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("compose button opens drawer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Compose/i }).click();
    const dialog = page.getByRole("dialog", { name: /New message/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("To")).toBeVisible();
    await expect(dialog.getByLabel("Subject")).toBeVisible();
  });

  test("settings link navigates to settings page", async ({ page }) => {
    await page.goto("/");
    await page.locator('a[href="/settings"]').click();
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
