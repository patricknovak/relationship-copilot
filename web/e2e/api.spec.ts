import { expect, test } from "@playwright/test";

test.describe("API negative paths (no secrets spent)", () => {
  test("GET /api/health returns ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("cron daily-reminder rejects missing auth", async ({ request }) => {
    const res = await request.post("/api/cron/daily-reminder");
    expect(res.status()).toBe(401);
  });

  test("cron daily-reminder rejects wrong bearer", async ({ request }) => {
    const res = await request.post("/api/cron/daily-reminder", {
      headers: { authorization: "Bearer not-the-real-secret" },
    });
    expect(res.status()).toBe(401);
  });

  test("Stripe webhook rejects unsigned body", async ({ request }) => {
    const res = await request.post("/api/stripe/webhook", {
      data: "{}",
      headers: { "content-type": "application/json" },
    });
    // 400 when STRIPE_WEBHOOK_SECRET is set; 500 "not configured" in local CI.
    expect([400, 500]).toContain(res.status());
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test("account export requires a session", async ({ request }) => {
    const res = await request.get("/api/account/export");
    expect(res.status()).toBe(401);
  });
});
