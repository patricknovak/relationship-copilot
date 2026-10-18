import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  CRON_ROUTES,
  cronLog,
  cronMonitorSlug,
  cronRequest,
  CronRouteError,
  DEFAULT_ORIGIN,
} from "./workerCron";

describe("cronRequest", () => {
  it("maps the hourly schedule to the reminder route with the secret", () => {
    const req = cronRequest("20 * * * *", { CRON_SECRET: "s3cret" });
    expect(req).not.toBeNull();
    expect(req!.url).toBe(`${DEFAULT_ORIGIN}/api/cron/daily-reminder`);
    expect(req!.method).toBe("POST");
    expect(req!.headers.get("authorization")).toBe("Bearer s3cret");
    expect(req!.headers.get("user-agent")).toMatch(/cron/);
  });

  it("omits auth when no secret is set (the route then answers 401)", () => {
    const req = cronRequest("20 * * * *", {});
    expect(req!.headers.get("authorization")).toBeNull();
  });

  it("honours APP_ORIGIN and strips trailing slashes", () => {
    const req = cronRequest("20 * * * *", { APP_ORIGIN: "https://example.dev//" });
    expect(req!.url).toBe("https://example.dev/api/cron/daily-reminder");
  });

  it("returns null for an unknown schedule", () => {
    expect(cronRequest("0 0 * * *", {})).toBeNull();
  });
});

describe("cronLog", () => {
  it("marks non-2xx as failed and truncates the body", () => {
    expect(cronLog("c", "/p", 200, "ok").event).toBe("cron_tick");
    const bad = cronLog("c", "/p", 401, "x".repeat(600));
    expect(bad.event).toBe("cron_tick_failed");
    expect(bad.body).toHaveLength(500);
  });
});

describe("wrangler.jsonc", () => {
  it("declares exactly the schedules the Worker knows how to route", () => {
    const raw = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
    // Strip // comments (jsonc) before parsing.
    const json = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ""));
    expect([...(json.triggers?.crons ?? [])].sort()).toEqual(
      Object.keys(CRON_ROUTES).sort(),
    );
  });
});

describe("cronMonitorSlug", () => {
  it("names a Sentry monitor after each cron route", () => {
    expect(cronMonitorSlug("20 * * * *")).toBe("daily-reminder");
    expect(cronMonitorSlug("40 * * * *")).toBe("turn-reminder");
    expect(cronMonitorSlug("0 0 * * *")).toBeUndefined();
  });

  it("gives every schedule a distinct slug", () => {
    const slugs = Object.keys(CRON_ROUTES).map(cronMonitorSlug);
    expect(slugs.every(Boolean)).toBe(true);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("CronRouteError", () => {
  it("carries the path and status only", () => {
    const e = new CronRouteError("/api/cron/daily-reminder", 500);
    expect(e.message).toBe("cron route /api/cron/daily-reminder returned 500");
    expect(e.name).toBe("CronRouteError");
  });
});
