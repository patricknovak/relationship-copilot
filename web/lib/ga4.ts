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

/** Exact north-star event name — must match GA4 Admin key-event toggle. */
export const FIRST_MUTUAL_REVEAL_COMPLETED = "first_mutual_reveal_completed";

/** True when this completed reveal is the connection's first. */
export function isConnectionFirstReveal(revealedInstanceCount: number): boolean {
  return revealedInstanceCount === 1;
}

type Ga4EventParams = Record<string, string | number | boolean>;

/**
 * Fire-and-forget GA4 event via Measurement Protocol.
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
      // Don't let a hung GA endpoint stall the reveal response.
      signal: AbortSignal.timeout(4_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** North-star: first time both partners have shared on a connection. */
export async function trackFirstMutualRevealCompleted(): Promise<boolean> {
  return sendGa4Event(FIRST_MUTUAL_REVEAL_COMPLETED);
}
