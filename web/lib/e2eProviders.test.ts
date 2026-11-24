import { describe, expect, it } from "vitest";
import {
  loopbackUrl,
  RESEND_EMAILS_URL,
  resendEmailsUrl,
  stripeHostOverride,
} from "./e2eProviders";

describe("loopbackUrl", () => {
  it("accepts plain-http loopback URLs", () => {
    expect(loopbackUrl("http://127.0.0.1:3199/resend")?.port).toBe("3199");
    expect(loopbackUrl("http://localhost:3199")?.hostname).toBe("localhost");
  });

  it("rejects everything that could leave the machine", () => {
    for (const value of [
      undefined,
      "",
      "   ",
      "not a url",
      "https://127.0.0.1:3199", // https loopback is not what the fake speaks
      "http://example.com",
      "http://127.0.0.1.example.com",
      "http://localhost.example.com",
      "http://user:pass@127.0.0.1:3199",
      "http://10.0.0.5:3199",
      "http://[::1]:3199",
      "https://api.resend.com",
    ]) {
      expect(loopbackUrl(value)).toBeNull();
    }
  });
});

describe("resendEmailsUrl", () => {
  it("is the real Resend endpoint by default", () => {
    expect(resendEmailsUrl({})).toBe(RESEND_EMAILS_URL);
  });

  it("ignores a non-loopback override", () => {
    expect(resendEmailsUrl({ E2E_RESEND_API_URL: "https://evil.example/resend" })).toBe(
      RESEND_EMAILS_URL,
    );
  });

  it("uses a loopback fake", () => {
    expect(resendEmailsUrl({ E2E_RESEND_API_URL: "http://127.0.0.1:3199/resend" })).toBe(
      "http://127.0.0.1:3199/resend/emails",
    );
    expect(resendEmailsUrl({ E2E_RESEND_API_URL: "http://127.0.0.1:3199/" })).toBe(
      "http://127.0.0.1:3199/emails",
    );
  });
});

describe("stripeHostOverride", () => {
  it("is off by default and for real hosts", () => {
    expect(stripeHostOverride({})).toBeNull();
    expect(stripeHostOverride({ E2E_STRIPE_API_URL: "https://api.stripe.com" })).toBeNull();
    expect(stripeHostOverride({ E2E_STRIPE_API_URL: "http://stripe.example:80" })).toBeNull();
  });

  it("points the SDK at a loopback fake", () => {
    expect(stripeHostOverride({ E2E_STRIPE_API_URL: "http://127.0.0.1:3199" })).toEqual({
      host: "127.0.0.1",
      port: 3199,
      protocol: "http",
    });
  });
});
