import { describe, expect, it } from "vitest";
import {
  emailConfigProblem,
  missingForEmail,
  NotificationConfigError,
  notificationConfigReport,
} from "./notifyConfig";

const ALL = {
  RESEND_API_KEY: "re_x",
  NOTIFY_SECRET: "s",
  VAPID_PUBLIC_KEY: "pub",
  VAPID_PRIVATE_KEY: "priv",
};

describe("notificationConfigReport", () => {
  it("reports both channels on when everything is set", () => {
    expect(notificationConfigReport(ALL)).toEqual({ email: true, push: true, missing: [] });
  });

  it("needs BOTH email variables: the key alone can't sign unsubscribe links", () => {
    const { NOTIFY_SECRET: _omit, ...env } = ALL;
    void _omit;
    expect(notificationConfigReport(env)).toEqual({ email: false, push: true, missing: ["NOTIFY_SECRET"] });
    expect(missingForEmail(env)).toEqual(["NOTIFY_SECRET"]);
  });

  it("is the production state of 2026-11: push keys set, email off", () => {
    const report = notificationConfigReport({ VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv" });
    expect(report.email).toBe(false);
    expect(report.push).toBe(true);
    expect(report.missing).toEqual(["RESEND_API_KEY", "NOTIFY_SECRET"]);
  });

  it("treats blank values as missing", () => {
    expect(notificationConfigReport({ ...ALL, RESEND_API_KEY: "  " }).email).toBe(false);
    expect(notificationConfigReport({ ...ALL, VAPID_PRIVATE_KEY: "" }).push).toBe(false);
  });

  it("never includes a value, only names", () => {
    const text = JSON.stringify(notificationConfigReport({ RESEND_API_KEY: "re_secret_value" }));
    expect(text).not.toContain("re_secret_value");
  });
});

describe("emailConfigProblem", () => {
  it("is an error in production when email can't send", () => {
    const problem = emailConfigProblem({ NODE_ENV: "production", VAPID_PUBLIC_KEY: "p", VAPID_PRIVATE_KEY: "q" });
    expect(problem).toBeInstanceOf(NotificationConfigError);
    expect(problem?.message).toBe("notification email is off: missing RESEND_API_KEY and NOTIFY_SECRET");
  });

  it("names only what is missing", () => {
    const problem = emailConfigProblem({ NODE_ENV: "production", RESEND_API_KEY: "re_x" });
    expect(problem?.message).toBe("notification email is off: missing NOTIFY_SECRET");
  });

  it("is quiet when email is configured", () => {
    expect(emailConfigProblem({ NODE_ENV: "production", ...ALL })).toBeNull();
  });

  it("is quiet outside production (local dev and tests run without email)", () => {
    expect(emailConfigProblem({ NODE_ENV: "development" })).toBeNull();
    expect(emailConfigProblem({ NODE_ENV: "test" })).toBeNull();
  });
});
