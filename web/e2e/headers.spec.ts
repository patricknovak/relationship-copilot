import { expect, test } from "@playwright/test";

test("security headers are present on HTML responses", async ({ request }) => {
  const res = await request.get("/");
  expect(res.ok()).toBeTruthy();
  const headers = res.headers();
  expect(headers["x-frame-options"]?.toLowerCase()).toBe("deny");
  expect(headers["x-content-type-options"]?.toLowerCase()).toBe("nosniff");
  expect(headers["referrer-policy"]).toMatch(/strict-origin/i);
  expect(headers["strict-transport-security"]).toMatch(/max-age=/i);

  // CSP is enforced (not report-only) with a per-request script nonce.
  expect(headers["content-security-policy-report-only"]).toBeFalsy();
  const csp = headers["content-security-policy"];
  expect(csp).toBeTruthy();
  expect(csp).toMatch(/default-src/);
  expect(csp).toMatch(/script-src[^;]*'nonce-/);
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
});
