import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Signed-in core-loop e2e against a LOCAL Supabase stack (see
// scripts/e2e-core-stack.sh). Separate from playwright.config.ts, which only
// covers public pages and negative API paths.
const port = Number(process.env.E2E_PORT || 3100);
// A second copy of the same build with the AI provider "on", for the billing
// tests only: checkout stays closed while AI is off, and the main server has
// to stay AI-off for the "nothing AI is sold" test.
const billingPort = Number(process.env.E2E_BILLING_PORT || 3101);
const fakePort = Number(process.env.E2E_FAKE_PROVIDERS_PORT || 3199);
// localhost, not 127.0.0.1: /auth/confirm redirects to the request origin
// Next reports (localhost), and the session cookie must be on that host.
const baseURL = `http://localhost:${port}`;
const billingURL = `http://localhost:${billingPort}`;
const fakeURL = `http://127.0.0.1:${fakePort}`;
const cloudChromium = "/opt/pw-browsers/chromium";

// Fixed, obviously fake values shared with e2e-core/helpers.ts. Email and
// Stripe calls go to e2e-core/fake-providers.mjs on loopback; nothing in
// this suite can send a real email or reach Stripe.
const serverEnv = {
  ...process.env,
  SUPABASE_SERVICE_ROLE_KEY: process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? "",
  NEXT_PUBLIC_SITE_URL: baseURL,
  RESEND_API_KEY: "re_e2e_fake_key",
  NOTIFY_SECRET: "e2e-notify-secret",
  CRON_SECRET: "e2e-cron-secret",
  STRIPE_SECRET_KEY: "sk_test_e2e_fake_key",
  STRIPE_WEBHOOK_SECRET: "whsec_e2e_fake_secret",
  E2E_RESEND_API_URL: `${fakeURL}/resend`,
  E2E_STRIPE_API_URL: fakeURL,
  // AI stays off here whatever the shell has set.
  XAI_API_KEY: "",
  XAI_NO_TRAINING_DPA: "false",
};

const BILLING_SPECS = /billing\.spec\.ts$/;

export default defineConfig({
  testDir: "./e2e-core",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: existsSync(cloudChromium) ? { executablePath: cloudChromium } : undefined,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: BILLING_SPECS },
    {
      name: "billing",
      use: { ...devices["Desktop Chrome"], baseURL: billingURL },
      testMatch: BILLING_SPECS,
    },
  ],
  webServer: [
    {
      command: "node e2e-core/fake-providers.mjs",
      url: `${fakeURL}/__health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { E2E_FAKE_PROVIDERS_PORT: String(fakePort) },
    },
    {
      command: `npx next start --port ${port}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: serverEnv,
    },
    {
      command: `npx next start --port ${billingPort}`,
      url: billingURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...serverEnv,
        XAI_API_KEY: "xai-e2e-fake-key",
        XAI_NO_TRAINING_DPA: "true",
        XAI_BASE_URL: `${fakeURL}/xai/v1`,
      },
    },
  ],
});
