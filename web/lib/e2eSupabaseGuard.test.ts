import { describe, expect, it } from "vitest";
import {
  e2ePublicSupabaseEnv,
  isProductionSupabaseUrl,
  PRODUCTION_SUPABASE_HOST,
} from "./e2eSupabaseGuard";

describe("isProductionSupabaseUrl", () => {
  it("detects the production project host", () => {
    expect(
      isProductionSupabaseUrl(`https://${PRODUCTION_SUPABASE_HOST}`),
    ).toBe(true);
    expect(
      isProductionSupabaseUrl(
        `https://${PRODUCTION_SUPABASE_HOST}/auth/v1`,
      ),
    ).toBe(true);
  });

  it("allows local and unrelated hosts", () => {
    expect(isProductionSupabaseUrl("http://127.0.0.1:54321")).toBe(false);
    expect(isProductionSupabaseUrl("http://localhost:54321")).toBe(false);
    expect(isProductionSupabaseUrl("https://example.supabase.co")).toBe(false);
    expect(isProductionSupabaseUrl(undefined)).toBe(false);
  });
});

describe("e2ePublicSupabaseEnv", () => {
  it("defaults to a local mock URL", () => {
    const env = e2ePublicSupabaseEnv({});
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toMatch(/e2e-mock/);
  });

  it("honours E2E_SUPABASE_URL when local", () => {
    const env = e2ePublicSupabaseEnv({
      E2E_SUPABASE_URL: "http://127.0.0.1:54321",
      E2E_SUPABASE_ANON_KEY: "local-anon",
    });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("local-anon");
  });

  it("throws when pointed at production", () => {
    expect(() =>
      e2ePublicSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_HOST}`,
      }),
    ).toThrow(/Refusing production Supabase/);
  });
});
