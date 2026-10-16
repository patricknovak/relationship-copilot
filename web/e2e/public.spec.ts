import { expect, test } from "@playwright/test";

test.describe("Public marketing surfaces", () => {
  test("landing shows brand, headline, and primary CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Relationship\s+Copilot/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Invite your person|Start free/i }).first(),
    ).toBeVisible();
    // JSON-LD for SoftwareApplication / Offer stays on the homepage.
    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd).toHaveCount(1);
    const raw = await jsonLd.first().textContent();
    expect(raw).toContain("Relationship Copilot");
    expect(raw).toMatch(/18(\.00)?/);
  });

  test("pricing lists Free and Premium without charging", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: /pricing/i })).toBeVisible();
    await expect(page.getByText("$0")).toBeVisible();
    await expect(page.getByText("$18/mo")).toBeVisible();
    // Signed-out: Free CTA goes to login; Premium CTA is login or checkout form.
    await expect(page.getByRole("link", { name: /Get started/i })).toBeVisible();
    // Never auto-redirect into Stripe from a GET of /pricing.
    expect(page.url()).toContain("/pricing");
  });

  test("Safety is public, free, and has quick exit", async ({ page }) => {
    await page.goto("/safety");
    await expect(page.getByRole("heading", { name: /Safety/i })).toBeVisible();
    await expect(page.getByText("Call or text 988")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Quickly leave this page|Quick exit/i }),
    ).toBeVisible();
  });

  test("about, library, and a /for page render", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto("/library");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto("/for/partners");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("robots and sitemap are reachable", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBeTruthy();
    expect(await robots.text()).toMatch(/Sitemap/i);

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBeTruthy();
    expect(await sitemap.text()).toContain("relationshipcopilot.com");
  });
});
