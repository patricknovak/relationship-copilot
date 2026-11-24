// Server-only transactional email via Resend's HTTP API. The domain already
// signs mail for Resend (Supabase auth uses it over SMTP), so this reuses that
// setup. Without RESEND_API_KEY nothing sends; lib/notifyConfig.ts is what
// makes that loud in production.

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  // One-click unsubscribe (RFC 8058); clients show a native "Unsubscribe".
  unsubscribeUrl?: string;
  // Stable per notification (kind + instance + recipient). Makes a retry
  // safe: the provider sends a given key at most once.
  idempotencyKey?: string;
}

export type SendResult =
  | { sent: true; id: string | null }
  | { sent: false; reason: "not_configured" | "rejected" | "failed" };

export const DEFAULT_FROM =
  "Relationship Copilot <noreply@relationshipcopilot.com>";

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

// Statuses worth one more try: rate limit and provider-side errors. A 4xx
// (bad address, unverified domain, bad key) will fail the same way again.
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

const ATTEMPTS = 2;
const RETRY_DELAY_MS = 700;

type Attempt =
  | { ok: true; id: string | null }
  | { ok: false; retry: boolean; reason: "rejected" | "failed"; status?: number };

async function attempt(apiKey: string, mail: OutgoingEmail): Promise<Attempt> {
  const mailHeaders: Record<string, string> = {};
  if (mail.unsubscribeUrl) {
    mailHeaders["List-Unsubscribe"] = `<${mail.unsubscribeUrl}>`;
    mailHeaders["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (mail.idempotencyKey) headers["Idempotency-Key"] = mail.idempotencyKey;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        headers: mailHeaders,
      }),
      // A slow provider must not pin a server action or a cron run.
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      return { ok: true, id: data.id ?? null };
    }
    // 409 with our key: the provider already has this exact notification
    // (an earlier attempt got through and only its response was lost).
    if (res.status === 409 && mail.idempotencyKey) return { ok: true, id: null };
    // Resend's error body is { name, message }; the name is a fixed code
    // ("validation_error", "rate_limit_exceeded") and safe to log. The
    // message can echo the address, so it is not logged.
    const body = (await res.json().catch(() => ({}))) as { name?: unknown };
    console.error(
      "[email] provider rejected send",
      res.status,
      typeof body.name === "string" ? body.name.slice(0, 60) : "",
    );
    return { ok: false, retry: isRetryableStatus(res.status), reason: "rejected", status: res.status };
  } catch (err) {
    // Timeout or network error. Log the error name only: fetch errors can
    // carry the request in their message.
    console.error("[email] send failed", err instanceof Error ? err.name : "unknown");
    return { ok: false, retry: true, reason: "failed" };
  }
}

// One retry on a timeout, network error, 429 or 5xx. With an idempotency key
// the retry cannot deliver twice: the provider answers a repeated key with
// the first result instead of sending again (keys live 24 hours).
export async function sendEmail(
  mail: OutgoingEmail,
  opts: { retryDelayMs?: number } = {},
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "not_configured" };

  let last: Attempt = { ok: false, retry: false, reason: "failed" };
  for (let i = 0; i < ATTEMPTS; i += 1) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, opts.retryDelayMs ?? RETRY_DELAY_MS));
    }
    last = await attempt(apiKey, mail);
    if (last.ok) return { sent: true, id: last.id };
    if (!last.retry) break;
  }
  return { sent: false, reason: last.ok ? "failed" : last.reason };
}
