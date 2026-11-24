// Server-only Grok (xAI) client, OpenAI-compatible. Never import into client
// components. The model is read from env so it can change without code edits.

export interface GrokMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Default model when XAI_MODEL is unset. Patrick's call (2026-10-18). */
export const DEFAULT_GROK_MODEL = "grok-latest";

/** The model every AI call uses, and the name recorded on insights. */
export function grokModel(): string {
  return process.env.XAI_MODEL?.trim() || DEFAULT_GROK_MODEL;
}

let warnedAboutDpa = false;

/**
 * Why a call failed, so callers and logs can tell a slow provider from a
 * rate limit from a misconfiguration without reading provider text.
 */
export type GrokErrorKind =
  | "config" // no key, or no attested DPA in production
  | "timeout"
  | "rate_limit" // 429 after the retry
  | "server" // 5xx after the retry
  | "rejected" // other 4xx: bad model id, bad request, auth
  | "network"
  | "empty"; // 200 with no usable content

export class GrokError extends Error {
  constructor(
    public readonly kind: GrokErrorKind,
    public readonly status?: number,
  ) {
    // Never the provider's response body: it can echo the prompt, and error
    // messages travel to logs and error reporting.
    super(`Grok request failed (${kind}${status ? ` ${status}` : ""})`);
    this.name = "GrokError";
  }
}

export interface GrokOptions {
  json?: boolean;
  temperature?: number;
  /** Ceiling on generated tokens for this call. */
  maxTokens?: number;
  /** Deadline for the whole call, retry included. */
  timeoutMs?: number;
  /** Extra attempts after a 429, 5xx or network error. Default 1. */
  retries?: number;
}

/** Backstop against runaway output; the JSON we ask for is a few hundred tokens. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 4000;
export const DEFAULT_TIMEOUT_MS = 45_000;
const RETRY_BASE_MS = 600;
const RETRY_MAX_WAIT_MS = 3_000;

export function maxOutputTokens(): number {
  const n = Number(process.env.XAI_MAX_OUTPUT_TOKENS);
  return Number.isFinite(n) && n >= 256 ? Math.floor(n) : DEFAULT_MAX_OUTPUT_TOKENS;
}

/** Whether a failed attempt is worth one more try. Pure. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status <= 599);
}

/** How long to wait before the retry: Retry-After when sane, else a short backoff. Pure. */
export function retryDelayMs(retryAfter: string | null, attempt: number): number {
  const secs = Number(retryAfter);
  if (retryAfter && Number.isFinite(secs) && secs >= 0) {
    return Math.min(secs * 1000, RETRY_MAX_WAIT_MS);
  }
  return Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_WAIT_MS);
}

function kindForStatus(status: number): GrokErrorKind {
  if (status === 429) return "rate_limit";
  if (status >= 500 || status === 408) return "server";
  return "rejected";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function grokChat(messages: GrokMessage[], opts: GrokOptions = {}): Promise<string> {
  try {
    return await grokChatInner(messages, opts);
  } catch (e) {
    // One line per failure, with no prompt or response text, so an outage or
    // a bad model id is visible in the Worker logs instead of only as a
    // "couldn't finish" banner.
    const err = e instanceof GrokError ? e : new GrokError("network");
    console.error(`[grok] ${err.message} model=${grokModel()}`);
    throw err;
  }
}

async function grokChatInner(messages: GrokMessage[], opts: GrokOptions): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new GrokError("config");

  // Operational guardrail: production AI calls require an attested
  // no-training data agreement with the provider (XAI_NO_TRAINING_DPA=true).
  // Non-production environments warn once instead of failing, so local
  // development still works.
  if (process.env.XAI_NO_TRAINING_DPA !== "true") {
    if (process.env.NODE_ENV === "production") throw new GrokError("config");
    if (!warnedAboutDpa) {
      warnedAboutDpa = true;
      console.warn(
        "[grok] XAI_NO_TRAINING_DPA is not set — AI calls would be blocked in production.",
      );
    }
  }
  const baseUrl = process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";
  const model = grokModel();
  const deadline = Date.now() + (opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const retries = opts.retries ?? 1;
  const body = JSON.stringify({
    model,
    messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? maxOutputTokens(),
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  });

  for (let attempt = 0; ; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new GrokError("timeout");

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        // A hung provider request must fail well inside the platform's own
        // limit, so the person gets our "try again" banner and their free
        // Blueprint back, not a dead page.
        signal: AbortSignal.timeout(remaining),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body,
      });
    } catch (e) {
      const name = (e as { name?: string } | null)?.name;
      if (name === "TimeoutError" || name === "AbortError") throw new GrokError("timeout");
      if (attempt < retries) {
        await sleep(Math.min(retryDelayMs(null, attempt), Math.max(0, deadline - Date.now())));
        continue;
      }
      throw new GrokError("network");
    }

    if (!res.ok) {
      // Drain the body so the connection can be reused; never keep its text.
      await res.text().catch(() => "");
      if (isRetryableStatus(res.status) && attempt < retries) {
        const wait = retryDelayMs(res.headers.get("retry-after"), attempt);
        if (wait < deadline - Date.now()) {
          await sleep(wait);
          continue;
        }
      }
      throw new GrokError(kindForStatus(res.status), res.status);
    }

    let data: { choices?: { message?: { content?: string } }[] };
    try {
      data = (await res.json()) as typeof data;
    } catch {
      throw new GrokError("empty");
    }
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new GrokError("empty");
    return content;
  }
}

/**
 * Whether an AI call can run here at all: a key, and in production the
 * no-training attestation (the same rule grokChat enforces). Lets callers
 * skip optional AI work, such as generate-on-visit, instead of failing.
 */
export function aiEnabled(): boolean {
  if (!process.env.XAI_API_KEY) return false;
  return process.env.NODE_ENV !== "production" || process.env.XAI_NO_TRAINING_DPA === "true";
}
