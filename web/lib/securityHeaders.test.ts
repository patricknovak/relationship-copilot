import { describe, expect, it } from "vitest";
import {
  buildCspDirectives,
  buildEnforcedSecurityHeaders,
  buildSecurityHeaders,
  formatCsp,
  FRAME_OPTIONS,
  HSTS,
  NOSNIFF,
  PERMISSIONS_POLICY,
  REFERRER_POLICY,
  supabaseConnectOrigins,
} from "./securityHeaders";

describe("supabaseConnectOrigins", () => {
  it("derives https + wss from NEXT_PUBLIC_SUPABASE_URL", () => {
    expect(
      supabaseConnectOrigins("https://digbnrhwsifmycrxyquo.supabase.co"),
    ).toEqual([
      "https://digbnrhwsifmycrxyquo.supabase.co",
      "wss://digbnrhwsifmycrxyquo.supabase.co",
    ]);
  });

  it("falls back to wildcard supabase hosts when unset", () => {
    expect(supabaseConnectOrigins(undefined)).toEqual([
      "https://*.supabase.co",
      "wss://*.supabase.co",
    ]);
    expect(supabaseConnectOrigins("")).toEqual([
      "https://*.supabase.co",
      "wss://*.supabase.co",
    ]);
  });
});

describe("buildCspDirectives", () => {
  it("includes frame-ancestors none and object-src none", () => {
    const d = buildCspDirectives("https://example.supabase.co");
    expect(d["frame-ancestors"]).toBe("'none'");
    expect(d["object-src"]).toBe("'none'");
    expect(d["base-uri"]).toBe("'self'");
  });

  it("allowlists GTM, Turnstile, GA collect, and derived Supabase origins", () => {
    const d = buildCspDirectives("https://example.supabase.co");
    expect(d["script-src"]).toContain("https://www.googletagmanager.com");
    expect(d["script-src"]).toContain("https://challenges.cloudflare.com");
    expect(d["frame-src"]).toContain("https://challenges.cloudflare.com");
    expect(d["connect-src"]).toContain("https://example.supabase.co");
    expect(d["connect-src"]).toContain("wss://example.supabase.co");
    expect(d["connect-src"]).toContain("https://www.google-analytics.com");
    expect(d["connect-src"]).toContain("https://*.google-analytics.com");
    expect(d["form-action"]).toContain("https://checkout.stripe.com");
  });

  it("does not allow framing or broad script wildcards", () => {
    const d = buildCspDirectives("https://example.supabase.co");
    expect(d["script-src"]).not.toContain("*");
    expect(d["default-src"]).toBe("'self'");
  });
});

describe("formatCsp", () => {
  it("serializes directives including valueless upgrade-insecure-requests", () => {
    const csp = formatCsp({
      "default-src": "'self'",
      "upgrade-insecure-requests": "",
    });
    expect(csp).toBe("default-src 'self'; upgrade-insecure-requests");
  });
});

describe("buildSecurityHeaders", () => {
  it("always enforces hsts/frame/nosniff/referrer/permissions", () => {
    const keys = buildEnforcedSecurityHeaders().map((h) => h.key);
    expect(keys).toEqual([
      "Strict-Transport-Security",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ]);
    const map = Object.fromEntries(
      buildEnforcedSecurityHeaders().map((h) => [h.key, h.value]),
    );
    expect(map["X-Frame-Options"]).toBe(FRAME_OPTIONS);
    expect(map["X-Content-Type-Options"]).toBe(NOSNIFF);
    expect(map["Referrer-Policy"]).toBe(REFERRER_POLICY);
    expect(map["Permissions-Policy"]).toBe(PERMISSIONS_POLICY);
    expect(map["Permissions-Policy"]).toContain("camera=()");
    expect(map["Permissions-Policy"]).toContain("microphone=()");
    expect(map["Permissions-Policy"]).toContain("geolocation=()");
  });

  it("defaults CSP to Report-Only", () => {
    const headers = buildSecurityHeaders({
      supabaseUrl: "https://example.supabase.co",
    });
    const csp = headers.find(
      (h) => h.key === "Content-Security-Policy-Report-Only",
    );
    expect(csp).toBeDefined();
    expect(csp!.value).toContain("frame-ancestors 'none'");
    expect(
      headers.find((h) => h.key === "Content-Security-Policy"),
    ).toBeUndefined();
  });

  it("can emit enforcing CSP when requested", () => {
    const headers = buildSecurityHeaders({
      supabaseUrl: "https://example.supabase.co",
      cspMode: "enforce",
    });
    expect(
      headers.find((h) => h.key === "Content-Security-Policy")?.value,
    ).toContain("script-src");
    expect(
      headers.find((h) => h.key === "Content-Security-Policy-Report-Only"),
    ).toBeUndefined();
  });

  it("sets HSTS exactly as Vercel did (two years, no subdomains, no preload)", () => {
    const headers = buildSecurityHeaders({ cspMode: "enforce" });
    const hsts = headers.filter(
      (h) => h.key.toLowerCase() === "strict-transport-security",
    );
    expect(hsts).toHaveLength(1);
    expect(hsts[0].value).toBe("max-age=63072000");
    expect(HSTS).toBe("max-age=63072000");
  });

  it("keeps next.config.mjs in lockstep with the enforced headers", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
    for (const h of buildEnforcedSecurityHeaders()) {
      expect(src).toContain(`key: "${h.key}"`);
    }
    expect(src).toContain(`const HSTS = "${HSTS}";`);
  });
});
