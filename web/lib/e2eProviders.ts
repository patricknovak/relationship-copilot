// Test seam for the signed-in e2e suite (e2e-core): lets the suite point the
// two outbound providers that have no configurable base URL (Resend and
// Stripe) at a fake server on the same machine, so the launch-critical flows
// run end to end without ever sending a real email or touching Stripe.
//
// The only values accepted are plain-http loopback URLs. Anything else, and
// in particular any real host, is ignored and the provider's real endpoint is
// used, so a stray or hostile value can never redirect mail or billing calls
// to a third party. On the Cloudflare Worker loopback is not reachable at
// all, and these variables are never set there.

type Env = Record<string, string | undefined>;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

/** The value as a URL when it is `http://127.0.0.1|localhost[:port]/…`, else null. */
export function loopbackUrl(value: string | undefined | null): URL | null {
  const raw = value?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:") return null;
  if (!LOOPBACK_HOSTS.has(url.hostname)) return null;
  if (url.username || url.password) return null;
  return url;
}

export const RESEND_EMAILS_URL = "https://api.resend.com/emails";

/** Where email sends go: Resend, unless a loopback fake is configured. */
export function resendEmailsUrl(env: Env = process.env): string {
  const fake = loopbackUrl(env.E2E_RESEND_API_URL);
  return fake ? `${fake.origin}${fake.pathname.replace(/\/$/, "")}/emails` : RESEND_EMAILS_URL;
}

/** Stripe SDK host options for a loopback fake, or null for the real API. */
export function stripeHostOverride(
  env: Env = process.env,
): { host: string; port: number; protocol: "http" } | null {
  const fake = loopbackUrl(env.E2E_STRIPE_API_URL);
  if (!fake) return null;
  return { host: fake.hostname, port: Number(fake.port || 80), protocol: "http" };
}
