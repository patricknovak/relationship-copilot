// Server-side GA4 Measurement Protocol helpers.
//
// Marketing pageviews still load via GTM (`NEXT_PUBLIC_GTM_ID` → container
// GTM-NT4DZRHK → property G-3HE7V5FTSR) on the public surface only — see
// `lib/analytics.ts`. Authenticated routes never load GTM, so product
// conversions that happen behind the mutual-reveal gate must be sent from
// the server with no connection, invite, or user IDs in the payload.
//
// If GA4_MEASUREMENT_ID or GA4_API_SECRET is unset, tracking is a no-op
// (local/preview default).
//
// Sends that must outlive the HTTP response (Vercel serverless) go through
// `scheduleGa4Event` → Next.js `after()`. Failures never affect reveal UX.

import { after } from "next/server";

/** Exact north-star event name — must match GA4 Admin key-event toggle. */
export const FIRST_MUTUAL_REVEAL_COMPLETED = "first_mutual_reveal_completed";

/** Funnel siblings (not key events) — invite → join → first reveal. */
export const INVITE_SENT = "invite_sent";
export const PARTNER_JOINED = "partner_joined";

export type FunnelStep = typeof INVITE_SENT | typeof PARTNER_JOINED;

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

type Ga4EventParams = Record<string, string | number | boolean>;

/**
 * GA4 event via Measurement Protocol.
 * Never throws; never includes user/connection identifiers.
 */
export async function sendGa4Event(
  name: string,
  params: Ga4EventParams = {},
): Promise<boolean> {
  const measurementId = process.env.GA4_MEASUREMENT_ID?.trim();
  const apiSecret = process.env.GA4_API_SECRET?.trim();
  if (!measurementId || !apiSecret) return false;

  // Anonymous client_id: counts the conversion without joining it to a
  // browser session or authenticated identity.
  const clientId = crypto.randomUUID();

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
              // Helps MP events register as engaged in GA4 reports.
              engagement_time_msec: 1,
              ...params,
            },
          },
        ],
      }),
      // Don't let a hung GA endpoint stall the reveal response / after() task.
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
 * Schedule a GA4 MP send to run after the response is sent so Vercel
 * serverless does not drop the fetch when the action returns.
 * Errors are swallowed and logged; never rethrown into the request.
 */
export function scheduleGa4Event(
  name: string,
  params: Ga4EventParams = {},
): void {
  after(async () => {
    try {
      await sendGa4Event(name, params);
    } catch (err) {
      console.error("[ga4] after() send failed", err);
    }
  });
}

/** North-star: first time both partners have shared on a connection. */
export async function trackFirstMutualRevealCompleted(): Promise<boolean> {
  return sendGa4Event(FIRST_MUTUAL_REVEAL_COMPLETED);
}

/** Schedule the north-star event after the response (preferred on reveal). */
export function scheduleFirstMutualRevealCompleted(): void {
  scheduleGa4Event(FIRST_MUTUAL_REVEAL_COMPLETED);
}

/** Schedule invite_sent after a successful share/email (once per connection). */
export function scheduleInviteSent(): void {
  scheduleGa4Event(INVITE_SENT);
}

/** Schedule partner_joined after accept_invite succeeds (once per connection). */
export function schedulePartnerJoined(): void {
  scheduleGa4Event(PARTNER_JOINED);
}
