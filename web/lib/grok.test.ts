import { afterEach, describe, expect, it, vi } from "vitest";
import { aiEnabled, DEFAULT_GROK_MODEL, grokModel } from "./grok";

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

describe("aiEnabled", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("needs a key", () => {
    vi.stubEnv("XAI_API_KEY", "");
    expect(aiEnabled()).toBe(false);
  });

  it("needs the no-training attestation in production", () => {
    vi.stubEnv("XAI_API_KEY", "k");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("XAI_NO_TRAINING_DPA", "");
    expect(aiEnabled()).toBe(false);
    vi.stubEnv("XAI_NO_TRAINING_DPA", "true");
    expect(aiEnabled()).toBe(true);
  });

  it("allows development without the attestation", () => {
    vi.stubEnv("XAI_API_KEY", "k");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("XAI_NO_TRAINING_DPA", "");
    expect(aiEnabled()).toBe(true);
  });
});
