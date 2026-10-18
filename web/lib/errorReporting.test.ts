import { afterEach, describe, expect, it, vi } from "vitest";
import { isFrameworkControlFlow, reportRequestError, setRequestErrorReporter } from "./errorReporting";

const info = { method: "POST", routePath: "/connections/[id]", routeType: "action" };

describe("reportRequestError", () => {
  afterEach(() => setRequestErrorReporter(undefined));

  it("does nothing when no reporter is registered (next dev, Vercel)", () => {
    expect(() => reportRequestError(new Error("x"), info)).not.toThrow();
  });

  it("forwards real errors with the route pattern only", () => {
    const reporter = vi.fn();
    setRequestErrorReporter(reporter);
    const err = new Error("boom");
    reportRequestError(err, info);
    expect(reporter).toHaveBeenCalledWith(err, info);
  });

  it("skips redirect() and notFound() control flow", () => {
    const reporter = vi.fn();
    setRequestErrorReporter(reporter);
    reportRequestError(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/x;307;" }), info);
    reportRequestError(Object.assign(new Error("x"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }), info);
    expect(reporter).not.toHaveBeenCalled();
  });

  it("never throws if the reporter does", () => {
    setRequestErrorReporter(() => {
      throw new Error("sentry down");
    });
    expect(() => reportRequestError(new Error("x"), info)).not.toThrow();
  });
});

describe("isFrameworkControlFlow", () => {
  it("only matches well-known digests", () => {
    expect(isFrameworkControlFlow({ digest: "NEXT_NOT_FOUND" })).toBe(true);
    expect(isFrameworkControlFlow({ digest: "12345" })).toBe(false);
    expect(isFrameworkControlFlow(new Error("NEXT_REDIRECT"))).toBe(false);
    expect(isFrameworkControlFlow(null)).toBe(false);
  });
});
