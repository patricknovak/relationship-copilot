import { describe, expect, it } from "vitest";
import {
  blueprintOffer,
  claimFreeBlueprint,
  freeBlueprintState,
  freeBlueprintSupported,
} from "./freeBlueprint";

// Tiny chainable stand-in: every builder method returns itself and the chain
// resolves to the configured result, which is all these helpers need.
function fakeClient(result: { data?: unknown; error?: { code?: string; message?: string } | null }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of ["select", "eq", "limit", "insert", "delete"]) chain[m] = self;
  chain.maybeSingle = async () => ({ data: result.data ?? null, error: result.error ?? null });
  chain.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: result.data ?? null, error: result.error ?? null });
  return { from: () => chain } as any;
}

describe("blueprintOffer", () => {
  const base = { isPremium: false, aiOn: true, revealed: true, free: "available" as const };

  it("never offers anything when the AI is off, even to Premium", () => {
    expect(blueprintOffer({ ...base, aiOn: false })).toBe("ai-off");
    expect(blueprintOffer({ ...base, aiOn: false, isPremium: true })).toBe("ai-off");
  });

  it("Premium always generates", () => {
    expect(blueprintOffer({ ...base, isPremium: true, free: "used" })).toBe("premium");
    expect(blueprintOffer({ ...base, isPremium: true, revealed: false })).toBe("premium");
  });

  it("offers the free Blueprint once the first set is revealed", () => {
    expect(blueprintOffer(base)).toBe("free");
    expect(blueprintOffer({ ...base, revealed: false })).toBe("free-later");
  });

  it("falls back to Premium when the free one is used or unsupported", () => {
    expect(blueprintOffer({ ...base, free: "used" })).toBe("upsell");
    expect(blueprintOffer({ ...base, free: "unsupported" })).toBe("upsell");
  });
});

describe("free Blueprint storage", () => {
  it("reads available, used and unsupported", async () => {
    expect(await freeBlueprintState(fakeClient({ data: null }), "c")).toBe("available");
    expect(await freeBlueprintState(fakeClient({ data: { connection_id: "c" } }), "c")).toBe("used");
    expect(
      await freeBlueprintState(fakeClient({ error: { code: "PGRST205", message: "missing" } }), "c"),
    ).toBe("unsupported");
  });

  it("claims once; a duplicate is 'used'; anything else is 'unsupported'", async () => {
    expect(await claimFreeBlueprint(fakeClient({}), "c", "u")).toBe("claimed");
    expect(await claimFreeBlueprint(fakeClient({ error: { code: "23505" } }), "c", "u")).toBe("used");
    expect(await claimFreeBlueprint(fakeClient({ error: { code: "42P01" } }), "c", "u")).toBe(
      "unsupported",
    );
  });

  it("reports support from whether the table answers", async () => {
    expect(await freeBlueprintSupported(fakeClient({}))).toBe(true);
    expect(await freeBlueprintSupported(fakeClient({ error: { code: "PGRST205" } }))).toBe(false);
  });
});
