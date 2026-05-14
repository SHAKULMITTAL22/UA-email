import { test, expect } from "@playwright/test";

async function openAddAccount(page: import("@playwright/test").Page) {
  // On mobile (<1024px) the sidebar is behind a menu drawer. Open it first.
  const viewport = page.viewportSize();
  if (viewport && viewport.width < 1024) {
    await page.getByRole("button", { name: /Open menu/i }).click();
  }
  await page.getByRole("button", { name: /Add account/i }).first().click();
}

test.describe("Add account flow", () => {
  test("can open Add Account dialog and see IMAP form", async ({ page }) => {
    await page.goto("/");
    await openAddAccount(page);

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/Three ways in/i)).toBeVisible();

    await page.getByRole("button", { name: /Connect via IMAP/i }).click();
    await expect(page.getByLabel(/Email address/i)).toBeVisible();
    await expect(page.getByLabel(/App password/i)).toBeVisible();
  });

  test("auto-detects gmail.com IMAP server preset", async ({ page }) => {
    await page.goto("/");
    await openAddAccount(page);
    await page.getByRole("button", { name: /Connect via IMAP/i }).click();

    await page.getByLabel(/Email address/i).fill("test@gmail.com");
    await expect(page.getByText(/imap\.gmail\.com:993/i)).toBeVisible();
    await expect(page.getByText(/Google App Password/i)).toBeVisible();
  });
});
