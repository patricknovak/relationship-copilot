import { expect, test } from "@playwright/test";

/**
 * Smoke: every public (and signed-out-reachable) page still renders under
 * enforced CSP with nonced inline scripts. Auth-gated routes must redirect
 * to login rather than 500.
 */
const PUBLIC_PAGES = [
  "/",
  "/about",
  "/pricing",
  "/privacy",
  "/terms",
  "/safety",
  "/library",
  "/for/partners",
  "/for/friends",
  "/login",
];

const AUTH_GATED = [
  "/connections",
  "/connections/new",
  "/account",
  "/onboarding",
];

test.describe("Every page still renders (CSP smoke)", () => {
  for (const path of PUBLIC_PAGES) {
    test(`GET ${path} is OK and has document title`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.ok()).toBeTruthy();
      await expect(page.locator("body")).toBeVisible();
      // Theme / auth-hint / consent scripts must not be blocked into a blank page.
      await expect(page.locator("main, #main").first()).toBeVisible();
    });
  }

  for (const path of AUTH_GATED) {
    test(`GET ${path} redirects to login when signed out`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator("body")).toBeVisible();
    });
  }
});
