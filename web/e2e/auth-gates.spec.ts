import { expect, test } from "@playwright/test";

test.describe("Auth gates (unsigned)", () => {
  for (const path of ["/connections", "/account", "/onboarding"] as const) {
    test(`${path} redirects to login with next=`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=`));
      const url = new URL(page.url());
      expect(url.searchParams.get("next")).toMatch(
        new RegExp(`^${path.replace("/", "\\/")}`),
      );
    });
  }

  test("login page shows Google and email path", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Production auth providers include Google (see .env.production).
    await expect(
      page.getByRole("button", { name: /Google/i }).or(
        page.getByRole("link", { name: /Google/i }),
      ),
    ).toBeVisible();
    // Email is secondary until opened.
    const emailToggle = page.getByRole("button", { name: /email/i });
    if (await emailToggle.isVisible().catch(() => false)) {
      await emailToggle.click();
    }
    await expect(page.getByLabel(/email/i).or(page.locator('input[type="email"]'))).toBeVisible();
  });

  test("open-redirect next= does not leave the login origin", async ({ page }) => {
    // The bad next= may remain in the query string until auth completes;
    // safeNextPath (login + callback) must never navigate off-origin.
    await page.goto("/login?next=https://evil.example/phish");
    await expect(page).toHaveURL(/\/login/);
    expect(new URL(page.url()).origin).toMatch(/127\.0\.0\.1|localhost/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("open-redirect next=//evil.com stays on login origin", async ({ page }) => {
    await page.goto("/login?next=//evil.com");
    await expect(page).toHaveURL(/\/login/);
    expect(new URL(page.url()).origin).toMatch(/127\.0\.0\.1|localhost/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("/questions/partners CTA next carries list into login", async ({ page }) => {
    await page.goto("/questions/partners");
    const cta = page.getByRole("link", { name: /Start a connection/i }).first();
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute("href");
    expect(href).toBeTruthy();
    // Signed-out: /login?next=<encoded /connections/new?type=romantic&list=partners>
    expect(href!).toMatch(/^\/login\?next=/);
    const next = new URL(href!, "http://localhost").searchParams.get("next");
    expect(next).toBe("/connections/new?type=romantic&list=partners");
  });

  test("/questions hub CTA next is connections/new without list", async ({ page }) => {
    await page.goto("/questions");
    const cta = page.getByRole("link", { name: /Start a connection/i }).first();
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute("href");
    expect(href).toBeTruthy();
    expect(href!).toMatch(/^\/login\?next=/);
    const next = new URL(href!, "http://localhost").searchParams.get("next");
    expect(next).toBe("/connections/new");
  });
});

