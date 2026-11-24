import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aiEnabled,
  DEFAULT_GROK_MODEL,
  DEFAULT_MAX_OUTPUT_TOKENS,
  GrokError,
  grokChat,
  grokModel,
  isRetryableStatus,
  retryDelayMs,
} from "./grok";

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

describe("grokChat failure handling", () => {
  const ok = (content: unknown) =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  const msgs = [{ role: "user" as const, content: "hi" }];
  const setup = (...responses: (Response | Error)[]) => {
    vi.stubEnv("XAI_API_KEY", "k");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("XAI_MAX_OUTPUT_TOKENS", "");
    const fetchMock = vi.fn(async () => {
      const next = responses.shift();
      if (!next) throw new Error("no more responses");
      if (next instanceof Error) throw next;
      return next;
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    return fetchMock;
  };
  const kindOf = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      expect(e).toBeInstanceOf(GrokError);
      return (e as GrokError).kind;
    }
    throw new Error("expected a failure");
  };
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("caps output tokens on every request", async () => {
    const f = setup(ok("{}"));
    await grokChat(msgs, { json: true });
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.max_tokens).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("retries once on a rate limit and then succeeds", async () => {
    const f = setup(new Response("slow down", { status: 429, headers: { "retry-after": "0" } }), ok("fine"));
    expect(await grokChat(msgs)).toBe("fine");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retry, with a kind and no provider text", async () => {
    const f = setup(
      new Response("secret prompt echo", { status: 503, headers: { "retry-after": "0" } }),
      new Response("secret prompt echo", { status: 503 }),
    );
    try {
      await grokChat(msgs);
      throw new Error("expected a failure");
    } catch (e) {
      expect((e as GrokError).kind).toBe("server");
      expect((e as GrokError).status).toBe(503);
      expect(String((e as Error).message)).not.toContain("secret");
    }
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("does not retry a rejected request (bad model id, bad key)", async () => {
    const f = setup(new Response("no such model", { status: 404 }));
    expect(await kindOf(grokChat(msgs))).toBe("rejected");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("reports a timeout as a timeout and does not retry it", async () => {
    const f = setup(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    expect(await kindOf(grokChat(msgs))).toBe("timeout");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("retries a dropped connection once", async () => {
    const f = setup(new TypeError("fetch failed"), ok("fine"));
    expect(await grokChat(msgs, { timeoutMs: 5000 })).toBe("fine");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("treats empty or non-JSON 200s as failures", async () => {
    setup(ok("   "));
    expect(await kindOf(grokChat(msgs, { retries: 0 }))).toBe("empty");
    setup(new Response("<html>gateway</html>", { status: 200 }));
    expect(await kindOf(grokChat(msgs, { retries: 0 }))).toBe("empty");
  });

  it("fails as config, without calling out, when the key or attestation is missing", async () => {
    const f = setup();
    vi.stubEnv("XAI_API_KEY", "");
    expect(await kindOf(grokChat(msgs))).toBe("config");
    vi.stubEnv("XAI_API_KEY", "k");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("XAI_NO_TRAINING_DPA", "");
    expect(await kindOf(grokChat(msgs))).toBe("config");
    expect(f).not.toHaveBeenCalled();
  });
});

describe("retry helpers", () => {
  it("retries only what can succeed on a second try", () => {
    expect([429, 500, 502, 503, 408].every(isRetryableStatus)).toBe(true);
    expect([400, 401, 403, 404, 422].some(isRetryableStatus)).toBe(false);
  });

  it("honours Retry-After within a ceiling", () => {
    expect(retryDelayMs("1", 0)).toBe(1000);
    expect(retryDelayMs("120", 0)).toBe(3000);
    expect(retryDelayMs(null, 0)).toBe(600);
    expect(retryDelayMs("soon", 1)).toBe(1200);
  });
});
