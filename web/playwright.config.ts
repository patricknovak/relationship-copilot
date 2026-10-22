import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { e2ePublicSupabaseEnv } from "./lib/e2eSupabaseGuard";

const port = Number(process.env.E2E_PORT || 3000);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const target = process.env.E2E_TARGET === "vinext" ? "vinext" : "next";

// Cloud agent VMs sometimes ship a pinned Chromium; prefer it when present.
const cloudChromium = "/opt/pw-browsers/chromium";
const executablePath = existsSync(cloudChromium)
  ? cloudChromium
  : undefined;

// Never inherit production Supabase from .env.production — public e2e only
// hits unsigned pages / negative API paths, but next start still constructs
// the browser client and was sending placeholder-key traffic to prod (~144/day).
const supabaseEnv = e2ePublicSupabaseEnv(process.env);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command:
          target === "vinext"
            ? `npx wrangler dev --config dist/server/wrangler.json --port ${port} --ip 127.0.0.1`
            : `npx next start --port ${port} --hostname 127.0.0.1`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // Local mock (or supabase start via E2E_SUPABASE_*) — never production.
        // A non-empty service-role placeholder lets createAdminClient construct
        // (invite preview); real invites/cron are not exercised without secrets.
        env: {
          ...process.env,
          ...supabaseEnv,
          SUPABASE_SERVICE_ROLE_KEY:
            process.env.SUPABASE_SERVICE_ROLE_KEY ||
            "e2e-placeholder-not-a-real-service-role-key",
          STRIPE_SECRET_KEY:
            process.env.STRIPE_SECRET_KEY || "sk_test_e2e_placeholder",
          STRIPE_WEBHOOK_SECRET:
            process.env.STRIPE_WEBHOOK_SECRET || "whsec_e2e_placeholder",
          CRON_SECRET: process.env.CRON_SECRET || "e2e-cron-secret",
          // Rel activation drip / Resend: intentionally unset → NO SEND.
        },
      },
});
