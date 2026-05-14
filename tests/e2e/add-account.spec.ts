import { test, expect } from "@playwright/test";

test.describe("Add account flow", () => {
  test("can open Add Account dialog and see IMAP form", async ({ page }) => {
    await page.goto("/");
    // With no accounts, the sidebar shows an inline "Add account" button.
    await page.getByRole("button", { name: /Add account/i }).first().click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/Three ways in/i)).toBeVisible();

    await page.getByRole("button", { name: /Connect via IMAP/i }).click();
    await expect(page.getByLabel(/Email address/i)).toBeVisible();
    await expect(page.getByLabel(/App password/i)).toBeVisible();
  });

  test("auto-detects gmail.com IMAP server preset", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Add account/i }).first().click();
    await page.getByRole("button", { name: /Connect via IMAP/i }).click();

    await page.getByLabel(/Email address/i).fill("test@gmail.com");
    await expect(page.getByText(/imap\.gmail\.com:993/i)).toBeVisible();
    await expect(page.getByText(/Google App Password/i)).toBeVisible();
  });
});
