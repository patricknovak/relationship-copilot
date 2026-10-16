import { describe, it, expect } from "vitest";
import { authorizeCronBearer } from "@/lib/cronAuth";

function req(authorization?: string): Request {
  return new Request("https://example.com/api/cron", {
    headers: authorization ? { authorization } : undefined,
  });
}

describe("authorizeCronBearer", () => {
  it("rejects when secret is missing", () => {
    expect(authorizeCronBearer(req("Bearer x"), null)).toBe(false);
    expect(authorizeCronBearer(req("Bearer x"), undefined)).toBe(false);
    expect(authorizeCronBearer(req("Bearer x"), "")).toBe(false);
  });

  it("rejects missing or wrong bearer", () => {
    expect(authorizeCronBearer(req(), "s3cret")).toBe(false);
    expect(authorizeCronBearer(req("Bearer wrong"), "s3cret")).toBe(false);
    expect(authorizeCronBearer(req("s3cret"), "s3cret")).toBe(false);
    // Trailing whitespace is stripped by the Fetch Headers API before we see it.
    expect(authorizeCronBearer(req("Bearer nope"), "s3cret")).toBe(false);
  });

  it("accepts the exact bearer token", () => {
    expect(authorizeCronBearer(req("Bearer s3cret"), "s3cret")).toBe(true);
  });

  it("rejects different-length guesses without throwing", () => {
    expect(authorizeCronBearer(req("Bearer s3"), "s3cret")).toBe(false);
    expect(authorizeCronBearer(req("Bearer s3cretXXXX"), "s3cret")).toBe(false);
  });
});
