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
// Sends that must outlive the HTTP response (Workers end the request when it
// returns; after() maps to ctx.waitUntil) go through
// `scheduleGa4Event` → Next.js `after()`. Failures never affect reveal UX.

import { after } from "next/server";

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
 *
 * Disabled until consent-gated sending (PR #137) ships. Server-side MP
 * previously fired for every user with no consent check (declined banner
 * or never answered). Call sites and exports stay unchanged.
 */
export async function sendGa4Event(
  name: string,
  params: Ga4EventParams = {},
): Promise<boolean> {
  // No-op: do not fetch until consent-gated sending (PR #137) ships.
  void name;
  void params;
  return false;
}

/**
 * Schedule a GA4 MP send to run after the response is sent, so the runtime
 * does not drop the fetch when the action returns.
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

/** Schedule sign_up_completed after first successful auth (once per user). */
export function scheduleSignUpCompleted(): void {
  scheduleGa4Event(SIGN_UP_COMPLETED);
}

/** Schedule invite_sent after a successful share/email (once per connection). */
export function scheduleInviteSent(): void {
  scheduleGa4Event(INVITE_SENT);
}

/** Schedule partner_joined after accept_invite succeeds (once per connection). */
export function schedulePartnerJoined(): void {
  scheduleGa4Event(PARTNER_JOINED);
}

/** Schedule first_question_answered after first onboarding submit (once per connection). */
export function scheduleFirstQuestionAnswered(): void {
  scheduleGa4Event(FIRST_QUESTION_ANSWERED);
}
