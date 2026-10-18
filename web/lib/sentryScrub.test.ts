import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { scrubEvent, scrubMessage, scrubPath, scrubTransaction } from "./sentryScrub";

// Everything a careless event could carry. None of it may survive.
const SECRETS = [
  "I miss our long walks",
  "she never listens",
  "sam@example.com",
  "AB12CD34",
  "3f2b8c1e-9a4d-4e2b-8f1a-2c3d4e5f6a7b",
  "sb-access-token",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
  "+1 (555) 123-4567",
  "note=hello",
  "Mozilla/5.0",
  "203.0.113.9",
  "Sam Rivera",
];

function nastyEvent() {
  return {
    event_id: "abc123",
    timestamp: 1_790_000_000,
    platform: "javascript",
    level: "error",
    release: "601ac81",
    environment: "production",
    server_name: "Sam Rivera's laptop",
    transaction: "GET /invite/AB12CD34",
    message: 'Saving "I miss our long walks" failed',
    exception: {
      values: [
        {
          type: "Error",
          value:
            'new row for relation "prompt_responses" violates check constraint "x"\nDETAIL: Failing row contains (3f2b8c1e-9a4d-4e2b-8f1a-2c3d4e5f6a7b, she never listens).',
          mechanism: { type: "onRequestError", handled: false },
          stacktrace: {
            frames: [
              {
                filename: "worker.js",
                function: "submitResponse",
                lineno: 10,
                colno: 4,
                in_app: true,
                vars: { answer: "she never listens", email: "sam@example.com" },
                context_line: 'const note = "I miss our long walks";',
                pre_context: ["Sam Rivera"],
              },
            ],
          },
        },
        {
          type: "Error",
          value: "Grok request failed (400): {\"error\":\"I miss our long walks\"} for sam@example.com",
        },
      ],
    },
    request: {
      method: "POST",
      url: "https://relationshipcopilot.com/invite/AB12CD34?note=hello#x",
      headers: { cookie: "sb-access-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", "user-agent": "Mozilla/5.0" },
      cookies: { "sb-access-token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" },
      data: { answer: "she never listens" },
      query_string: "note=hello",
      env: { REMOTE_ADDR: "203.0.113.9" },
    },
    user: { id: "3f2b8c1e-9a4d-4e2b-8f1a-2c3d4e5f6a7b", email: "sam@example.com", ip_address: "203.0.113.9" },
    extra: { body: "she never listens" },
    tags: {
      route: "/invite/[code]",
      route_type: "render",
      url: "https://relationshipcopilot.com/invite/AB12CD34",
      "user.email": "sam@example.com",
    },
    breadcrumbs: [{ category: "console", message: "answer: she never listens" }],
    contexts: {
      runtime: { name: "cloudflare", version: "2026-09-15" },
      trace: { trace_id: "t1", span_id: "s1", data: { "http.query": "note=hello" } },
      response: { body: "she never listens" },
      culture: { locale: "en-US", timezone: "America/Toronto" },
    },
  };
}

describe("scrubEvent", () => {
  it("lets no user content, identifier or credential through", () => {
    const json = JSON.stringify(scrubEvent(nastyEvent()));
    for (const s of SECRETS) expect(json, s).not.toContain(s);
  });

  it("keeps what locates the failure in code", () => {
    const out = scrubEvent(nastyEvent()) as ReturnType<typeof nastyEvent>;
    expect(out.release).toBe("601ac81");
    expect(out.environment).toBe("production");
    expect(out.transaction).toBe("GET /invite/:param");
    expect(out.request).toEqual({ method: "POST", url: "/invite/:param" });
    expect(out.tags).toEqual({ route: "/invite/[code]", route_type: "render" });
    expect(out.contexts).toEqual({
      runtime: { name: "cloudflare", version: "2026-09-15" },
      trace: { trace_id: "t1", span_id: "s1" },
    });
    const [first, second] = out.exception.values;
    expect(first.type).toBe("Error");
    expect(first.value).toBe("new row for relation [redacted] violates check constraint [redacted]");
    expect(first.mechanism).toEqual({ type: "onRequestError", handled: false });
    expect(first.stacktrace?.frames).toEqual([
      { filename: "worker.js", function: "submitResponse", lineno: 10, colno: 4, in_app: true },
    ]);
    expect(second.value).toBe("Grok request failed (400): {[redacted]:[redacted]} for [email]");
  });

  it("drops user, extra, breadcrumbs and server_name entirely", () => {
    const out = scrubEvent(nastyEvent()) as Record<string, unknown>;
    for (const k of ["user", "extra", "breadcrumbs", "server_name"]) expect(out[k]).toBeUndefined();
  });

  it("survives odd shapes without throwing", () => {
    expect(scrubEvent({})).toEqual({});
    expect(scrubEvent({ exception: { values: [null, "x"] }, request: "nope", tags: null })).toEqual({
      exception: { values: [] },
    });
  });
});

describe("scrubMessage", () => {
  it("keeps only the first line and caps the length", () => {
    expect(scrubMessage("boom\nDETAIL: secret")).toBe("boom");
    expect(scrubMessage("x".repeat(500)).length).toBeLessThanOrEqual(201);
  });

  it("redacts quoted text, including smart and unclosed quotes", () => {
    expect(scrubMessage("value “she never listens” rejected")).toBe("value [redacted] rejected");
    expect(scrubMessage("unterminated 'she never listens")).toBe("unterminated [redacted]");
  });

  it("redacts URLs to their host, emails, ids, tokens and numbers", () => {
    expect(scrubMessage("fetch https://x.supabase.co/rest/v1/a?id=eq.1 failed")).toBe(
      "fetch [url x.supabase.co] failed",
    );
    expect(scrubMessage("no user sam@example.com")).toBe("no user [email]");
    expect(scrubMessage("row 3f2b8c1e-9a4d-4e2b-8f1a-2c3d4e5f6a7b gone")).toBe("row [id] gone");
    expect(scrubMessage("bad key key_fake_abcdefghijklmnopqrstuvwxyz")).toBe("bad key [token]");
    expect(scrubMessage("call +1 (555) 123-4567")).toBe("call [number]");
  });

  it("leaves ordinary code-level messages readable", () => {
    expect(scrubMessage("XAI_API_KEY is not configured.")).toBe("XAI_API_KEY is not configured.");
    expect(scrubMessage("cron route /api/cron/daily-reminder returned 500")).toBe(
      "cron route /api/cron/daily-reminder returned 500",
    );
  });

  it("returns an empty string for non-strings", () => {
    expect(scrubMessage(undefined)).toBe("");
    expect(scrubMessage({ toString: () => "she never listens" })).toBe("");
  });
});

describe("scrubPath / scrubTransaction", () => {
  it("replaces ids and invite codes, drops origin, query and fragment", () => {
    expect(scrubPath("https://relationshipcopilot.com/connections/3f2b8c1e-9a4d-4e2b-8f1a-2c3d4e5f6a7b/blueprint?x=1#y")).toBe(
      "/connections/:param/blueprint",
    );
    expect(scrubPath("/invite/AB12CD34")).toBe("/invite/:param");
    // A lowercase all-letter invite code is still 8 characters long.
    expect(scrubPath("/invite/abcdefgh")).toBe("/invite/:param");
    expect(scrubPath("/connections/[id]")).toBe("/connections/[id]");
    expect(scrubTransaction("POST /api/stripe/webhook")).toBe("POST /api/stripe/webhook");
    expect(scrubTransaction("GET /invite/AB12CD34")).toBe("GET /invite/:param");
  });

  it("keeps every static route segment in app/ (lockstep with the router)", () => {
    const root = join(__dirname, "..", "app");
    const segments = new Set<string>();
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (!statSync(full).isDirectory()) continue;
        if (!name.startsWith("(") && !name.startsWith("[") && !name.startsWith("_")) segments.add(name);
        walk(full);
      }
    };
    walk(root);
    expect(segments.size).toBeGreaterThan(10);
    for (const seg of segments) expect(scrubPath(`/${seg}`), seg).toBe(`/${seg}`);
  });
});
