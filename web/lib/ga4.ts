// Server-side GA4 Measurement Protocol helpers.
//
// Marketing pageviews still load via GTM (`NEXT_PUBLIC_GTM_ID` → container
// GTM-NT4DZRHK → property G-3HE7V5FTSR) on the public surface only — see
// `lib/analytics.ts`. Authenticated routes never load GTM, so product
// conversions that happen behind the mutual-reveal gate must be sent from
// the server with no connection, invite, or user IDs in the payload.
//
// client_id is a stable pseudonym: HMAC-SHA256(user id, GA4_CLIENT_ID_SALT),
// shaped as a UUID. Missing salt → fail closed (no send). Sends also require
// the acting user's analytics consent to be "granted"; denied or unknown
// (including cron / no cookie) → no send.
//
// If GA4_MEASUREMENT_ID or GA4_API_SECRET is unset, tracking is a no-op
// (local/preview default).
//
// Sends that must outlive the HTTP response (Workers end the request when it
// returns; after() maps to ctx.waitUntil) go through
// `scheduleGa4Event` → Next.js `after()`. Failures never affect reveal UX.

import { createHmac } from "crypto";
import { after } from "next/server";
import type { ConsentChoice } from "@/lib/analytics";

/** Exact north-star event name — must match GA4 Admin key-event toggle. */
export const FIRST_MUTUAL_REVEAL_COMPLETED = "first_mutual_reveal_completed";

/** Funnel siblings (not key events) — sign-up → invite → join → first answer → reveal. */
export const SIGN_UP_COMPLETED = "sign_up_completed";
export const INVITE_SENT = "invite_sent";
export const PARTNER_JOINED = "partner_joined";
export const FIRST_QUESTION_ANSWERED = "first_question_answered";

/** Inviter submitted their first answers before their person joined (0033). */
export const ANSWERED_BEFORE_JOIN = "answered_before_join";
export type FunnelStep =
  | typeof INVITE_SENT
  | typeof PARTNER_JOINED
  | typeof ANSWERED_BEFORE_JOIN
  | typeof FIRST_QUESTION_ANSWERED;
export type UserFunnelStep = typeof SIGN_UP_COMPLETED;

/**
 * Identity for MP client_id. Never put email, name, or the raw user id in
 * the GA4 payload — only an HMAC-derived (or consented browser) client_id.
 */
export type Ga4ClientIdentity = {
  /** Supabase auth user id (HMAC'd; never sent as-is). */
  userId: string;
  /**
   * Acting user's analytics consent. Only `"granted"` may send.
   * `denied` / `null` (unknown — no cookie, cron, other partner) → no send.
   */
  analyticsConsent: ConsentChoice | null;
  /**
   * Optional GA client_id already known to the caller (e.g. from `_ga`).
   * Used only when analyticsConsent is granted. Do not read cookies here.
   */
  browserClientId?: string | null;
};

/** True when this completed reveal is the connection's first. */
export function isConnectionFirstReveal(revealedInstanceCount: number): boolean {
  return revealedInstanceCount === 1;
}

/**
 * True only when the DB granted this request the once-only funnel claim
 * (`claim_funnel_step`). Mirrors shouldTrackFirstMutualReveal.
 */
export function shouldTrackFunnelStep(claimGranted: boolean): boolean {
  return claimGranted === true;
}

/**
 * True only when the DB granted this request the once-only GA4 claim
 * (`claim_first_mutual_reveal_ga4`). Keeps the send decision explicit in
 * app code while the race is resolved in Postgres.
 */
export function shouldTrackFirstMutualReveal(claimGranted: boolean): boolean {
  return claimGranted === true;
}

let warnedMissingSalt = false;

/** Log once per isolate when the HMAC salt is unset (fail closed). */
export function warnMissingGa4ClientIdSaltOnce(): void {
  if (warnedMissingSalt) return;
  warnedMissingSalt = true;
  console.warn(
    "[ga4] GA4_CLIENT_ID_SALT unset; Measurement Protocol sends disabled",
  );
}

/** Test-only: reset the once-flag between cases. */
export function resetGa4ClientIdSaltWarningForTests(): void {
  warnedMissingSalt = false;
}

function uuidShapeFromHex(hex: string): string {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Stable pseudonymous GA4 client_id from a Supabase user id.
 * HMAC-SHA256 with GA4_CLIENT_ID_SALT → UUID-shaped string.
 * Returns null (and warns once) when the salt is missing — never falls back
 * to a plain hash or the raw id.
 */
export function ga4ClientIdFromUserId(userId: string): string | null {
  const salt = process.env.GA4_CLIENT_ID_SALT?.trim();
  if (!salt) {
    warnMissingGa4ClientIdSaltOnce();
    return null;
  }
  const hex = createHmac("sha256", salt).update(userId, "utf8").digest("hex");
  return uuidShapeFromHex(hex);
}

/** GA4 accepts UUID or the classic `digits.digits` client_id form. */
export function isValidGa4ClientId(
  value: string | null | undefined,
): value is string {
  if (!value || typeof value !== "string") return false;
  const v = value.trim();
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  ) {
    return true;
  }
  return /^\d+\.\d+$/.test(v);
}

/**
 * Prefer a consented browser client_id when the caller already passed one;
 * otherwise the HMAC-derived id. Returns null when salt is missing.
 */
export function resolveGa4ClientId(identity: Ga4ClientIdentity): string | null {
  if (
    identity.analyticsConsent === "granted" &&
    isValidGa4ClientId(identity.browserClientId)
  ) {
    return identity.browserClientId.trim();
  }
  return ga4ClientIdFromUserId(identity.userId);
}

type Ga4EventParams = Record<string, string | number | boolean>;

/**
 * GA4 event via Measurement Protocol.
 * Never throws; never includes user/connection identifiers or PII.
 * Requires analyticsConsent === "granted" and GA4_CLIENT_ID_SALT.
 */
export async function sendGa4Event(
  name: string,
  params: Ga4EventParams = {},
  identity: Ga4ClientIdentity,
): Promise<boolean> {
  if (identity.analyticsConsent !== "granted") return false;

  const measurementId = process.env.GA4_MEASUREMENT_ID?.trim();
  const apiSecret = process.env.GA4_API_SECRET?.trim();
  if (!measurementId || !apiSecret) return false;

  const clientId = resolveGa4ClientId(identity);
  if (!clientId) return false;

  const url = new URL("https://www.google-analytics.com/mp/collect");
  url.searchParams.set("measurement_id", measurementId);
  url.searchParams.set("api_secret", apiSecret);

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        non_personalized_ads: true,
        events: [
          {
            name,
            params: {
              engagement_time_msec: 1,
              ...params,
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) {
      console.error("[ga4] Measurement Protocol non-OK", res.status);
    }
    return res.ok;
  } catch (err) {
    console.error("[ga4] Measurement Protocol send failed", err);
    return false;
  }
}

/**
 * Schedule a GA4 MP send to run after the response is sent, so the runtime
 * does not drop the fetch when the action returns.
 * Errors are swallowed and logged; never rethrown into the request.
 */
export function scheduleGa4Event(
  name: string,
  params: Ga4EventParams = {},
  identity: Ga4ClientIdentity,
): void {
  after(async () => {
    try {
      await sendGa4Event(name, params, identity);
    } catch (err) {
      console.error("[ga4] after() send failed", err);
    }
  });
}

/** North-star: first time both partners have shared on a connection. */
export async function trackFirstMutualRevealCompleted(
  identity: Ga4ClientIdentity,
): Promise<boolean> {
  return sendGa4Event(FIRST_MUTUAL_REVEAL_COMPLETED, {}, identity);
}

/** Schedule the north-star event after the response (preferred on reveal). */
export function scheduleFirstMutualRevealCompleted(
  identity: Ga4ClientIdentity,
): void {
  scheduleGa4Event(FIRST_MUTUAL_REVEAL_COMPLETED, {}, identity);
}

/** Schedule sign_up_completed after first successful auth (once per user). */
export function scheduleSignUpCompleted(identity: Ga4ClientIdentity): void {
  scheduleGa4Event(SIGN_UP_COMPLETED, {}, identity);
}

/** Schedule invite_sent after a successful share/email (once per connection). */
export function scheduleInviteSent(identity: Ga4ClientIdentity): void {
  scheduleGa4Event(INVITE_SENT, {}, identity);
}

/** Schedule partner_joined after accept_invite succeeds (once per connection). */
export function schedulePartnerJoined(identity: Ga4ClientIdentity): void {
  scheduleGa4Event(PARTNER_JOINED, {}, identity);
}

/** Schedule first_question_answered after first onboarding submit (once per connection). */
export function scheduleFirstQuestionAnswered(
  identity: Ga4ClientIdentity,
): void {
  scheduleGa4Event(FIRST_QUESTION_ANSWERED, {}, identity);
}
