import { expect, test } from "@playwright/test";

/**
 * Core product shell without a live session. Full mutual-reveal / answer
 * flows need E2E_USER_EMAIL + magic-link or a stored session — those are
 * gated below so CI stays green without secrets.
 */
test.describe("Product shell (unsigned)", () => {
  test("new connection entry requires sign-in", async ({ page }) => {
    await page.goto("/connections/new?type=romantic");
    await expect(page).toHaveURL(/\/login\?next=/);
    const next = new URL(page.url()).searchParams.get("next") ?? "";
    expect(next).toContain("/connections/new");
    expect(next).toContain("type=romantic");
  });

  test("invite landing with bogus code stays public", async ({ page }) => {
    await page.goto("/invite/NOTAREALCODE99");
    // Either a friendly "not found" or invite chrome — never a 500.
    const status = await page.evaluate(() => document.title);
    expect(status.length).toBeGreaterThan(0);
    await expect(page.locator("body")).not.toContainText(/Application error/i);
  });

  test("library article list is browseable", async ({ page }) => {
    await page.goto("/library");
    const links = page.locator('a[href^="/library/"]');
    const count = await links.count();
    if (count === 0) {
      test.skip(true, "No library articles seeded in this environment");
      return;
    }
    await links.first().click();
    await expect(page).toHaveURL(/\/library\/.+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("Authenticated product flow (optional)", () => {
  // Set E2E_STORAGE_STATE to a Playwright storageState JSON path produced
  // from a test account to exercise the signed-in hub. CI does not set this.
  const storage = process.env.E2E_STORAGE_STATE;
  test.skip(!storage, "E2E_STORAGE_STATE not set — skip live product flow");

  test.use({ storageState: storage });

  test("connections hub loads for the test account", async ({ page }) => {
    await page.goto("/connections");
    await expect(page).toHaveURL(/\/connections/);
    await expect(
      page.getByRole("heading", { name: /connection/i }),
    ).toBeVisible();
  });
});
