// Google Ads enhanced conversions (account 741-146-2618) via the Google tag.
//
// Client-only. The north-star `first_mutual_reveal_completed` (and funnel
// siblings) go through Measurement Protocol server-side with no email — do
// not add identity there. Here we only ever send a SHA-256 of a
// trimmed/lowercased email the visitor typed on /login, and only when Consent
// Mode shows ad_storage + ad_user_data granted and the path is measurable.
// Defaults stay denied (see ConsentDefaults); this module never grants them.

import { isMeasurablePath } from "@/lib/analytics";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Normalize email the way Google Ads enhanced conversions expect. */
export function normalizeEmailForHash(email: string): string {
  return email.trim().toLowerCase();
}

/** SHA-256 hex digest of a normalized email (Web Crypto). */
export async function sha256EmailHex(email: string): Promise<string> {
  const normalized = normalizeEmailForHash(email);
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type ConsentFlags = {
  ad_storage: "granted" | "denied";
  ad_user_data: "granted" | "denied";
};

/**
 * Reconstruct Consent Mode ad flags from dataLayer consent default/update
 * commands. Matches ConsentDefaults (both denied) until something grants them.
 * Does not change defaults.
 */
export function readAdsConsentFlags(
  dataLayer: unknown[] | undefined,
): ConsentFlags {
  const flags: ConsentFlags = {
    ad_storage: "denied",
    ad_user_data: "denied",
  };
  if (!dataLayer) return flags;

  for (const entry of dataLayer) {
    const args = coerceGtagArgs(entry);
    if (!args) continue;
    if (args[0] !== "consent") continue;
    if (args[1] !== "default" && args[1] !== "update") continue;
    const payload = args[2];
    if (!payload || typeof payload !== "object") continue;
    const p = payload as Record<string, unknown>;
    if (p.ad_storage === "granted" || p.ad_storage === "denied") {
      flags.ad_storage = p.ad_storage;
    }
    if (p.ad_user_data === "granted" || p.ad_user_data === "denied") {
      flags.ad_user_data = p.ad_user_data;
    }
  }
  return flags;
}

export function adsEnhancedConsentGranted(
  dataLayer?: unknown[],
): boolean {
  const layer =
    dataLayer ??
    (typeof window !== "undefined"
      ? (window.dataLayer as unknown[] | undefined)
      : undefined);
  const flags = readAdsConsentFlags(layer);
  return flags.ad_storage === "granted" && flags.ad_user_data === "granted";
}

/**
 * If (and only if) email is present, ads consent is granted, and the path is
 * measurable: gtag('set','user_data',{ sha256_email_address }). Never pushes
 * the raw email to dataLayer and never logs it.
 */
export async function setEnhancedConversionUserDataIfAllowed(
  email: string | null | undefined,
  opts?: {
    pathname?: string;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  },
): Promise<boolean> {
  if (!email || !email.trim()) return false;

  const pathname =
    opts?.pathname ??
    (typeof window !== "undefined" ? window.location.pathname : "");
  if (!pathname || !isMeasurablePath(pathname)) return false;

  if (!adsEnhancedConsentGranted(opts?.dataLayer)) return false;

  const gtag =
    opts?.gtag ??
    (typeof window !== "undefined" ? window.gtag : undefined);
  if (!gtag) return false;

  const hash = await sha256EmailHex(email);
  gtag("set", "user_data", { sha256_email_address: hash });
  return true;
}

/**
 * Client signup conversion for email magic-link. Fired on /login after
 * signInWithOtp succeeds — the only measurable-path moment we have the typed
 * email. Post-auth routes (/connections, /onboarding) never load GTM.
 * Sets enhanced conversion user_data first when consent allows.
 */
export async function fireEmailSignUpConversion(
  email: string | null | undefined,
  opts?: {
    pathname?: string;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  },
): Promise<void> {
  if (!email || !email.trim()) return;

  const pathname =
    opts?.pathname ??
    (typeof window !== "undefined" ? window.location.pathname : "");
  if (!pathname || !isMeasurablePath(pathname)) return;

  await setEnhancedConversionUserDataIfAllowed(email, opts);

  const gtag =
    opts?.gtag ??
    (typeof window !== "undefined" ? window.gtag : undefined);
  if (!gtag) return;
  gtag("event", "sign_up", { method: "email" });
}

function coerceGtagArgs(entry: unknown): unknown[] | null {
  if (!entry) return null;
  if (Array.isArray(entry)) return entry;
  // dataLayer entries from `dataLayer.push(arguments)` are Arguments-like.
  if (typeof entry === "object" && entry !== null && "0" in entry) {
    const obj = entry as Record<string, unknown>;
    const len =
      typeof (obj as { length?: unknown }).length === "number"
        ? (obj as { length: number }).length
        : Object.keys(obj).filter((k) => /^\d+$/.test(k)).length;
    const out: unknown[] = [];
    for (let i = 0; i < len; i++) out.push(obj[String(i)]);
    return out;
  }
  return null;
}
