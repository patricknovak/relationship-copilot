import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GROK_MODEL, grokModel } from "./grok";

describe("grokModel", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to grok-latest", () => {
    vi.stubEnv("XAI_MODEL", "");
    expect(grokModel()).toBe(DEFAULT_GROK_MODEL);
    expect(DEFAULT_GROK_MODEL).toBe("grok-latest");
  });

  it("lets XAI_MODEL override the default", () => {
    vi.stubEnv("XAI_MODEL", " grok-4.7 ");
    expect(grokModel()).toBe("grok-4.7");
  });
});
