/**
 * Per-request CSP nonce helpers. The proxy mints a nonce, puts it on the
 * request as `x-nonce` and inside `script-src 'nonce-…'`, and layout reads it
 * for inline ThemeScript / ConsentDefaults / AuthHint / GTM.
 */

export const CSP_NONCE_HEADER = "x-nonce";

/** URL-safe base64 nonce from a fresh UUID (Next.js CSP guide pattern). */
export function createCspNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

/** Format for embedding in a CSP source list or a script nonce attribute. */
export function cspNonceSource(nonce: string): string {
  return `'nonce-${nonce}'`;
}
