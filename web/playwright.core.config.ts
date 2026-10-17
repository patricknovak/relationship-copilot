import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Signed-in core-loop e2e against a LOCAL Supabase stack (see
// scripts/e2e-core-stack.sh). Separate from playwright.config.ts, which only
// covers public pages and negative API paths.
const port = Number(process.env.E2E_PORT || 3100);
// localhost, not 127.0.0.1: /auth/confirm redirects to the request origin
// Next reports (localhost), and the session cookie must be on that host.
const baseURL = `http://localhost:${port}`;
const cloudChromium = "/opt/pw-browsers/chromium";

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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      SUPABASE_SERVICE_ROLE_KEY: process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? "",
      NEXT_PUBLIC_SITE_URL: baseURL,
    },
  },
});
