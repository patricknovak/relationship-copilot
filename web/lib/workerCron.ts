// Cloudflare Cron Triggers → app routes. Pure so it can be unit-tested; the
// Worker entry (worker/index.ts) calls the route in-process with the cron
// secret, so auth, idempotency and logging stay in the route itself.
//
// Keep the schedules here in sync with `triggers.crons` in wrangler.jsonc
// (lib/workerCron.test.ts checks both).

export const CRON_ROUTES: Record<string, string> = {
  // Hourly: the reminder route emails each connection once per local day,
  // inside its own 9am–8pm window (app/api/cron/daily-reminder).
  "20 * * * *": "/api/cron/daily-reminder",
  // Hourly: one "still your turn" follow-up per set that has waited 36h+,
  // inside the recipient's local window (app/api/cron/turn-reminder).
  "40 * * * *": "/api/cron/turn-reminder",
};

export const DEFAULT_ORIGIN = "https://relationshipcopilot.com";

export interface CronEnv {
  CRON_SECRET?: string;
  APP_ORIGIN?: string;
}

/** The request a cron tick should make, or null for an unknown schedule. */
export function cronRequest(cron: string, env: CronEnv): Request | null {
  const path = CRON_ROUTES[cron];
  if (!path) return null;
  const headers = new Headers({ "user-agent": "relationship-copilot-cloudflare-cron" });
  if (env.CRON_SECRET) headers.set("authorization", `Bearer ${env.CRON_SECRET}`);
  const origin = (env.APP_ORIGIN || DEFAULT_ORIGIN).replace(/\/+$/, "");
  return new Request(`${origin}${path}`, { method: "POST", headers });
}

/** One structured log line per tick (Workers Observability indexes JSON). */
export function cronLog(cron: string, path: string, status: number, body: string) {
  return {
    event: status >= 200 && status < 300 ? "cron_tick" : "cron_tick_failed",
    cron,
    path,
    status,
    body: body.slice(0, 500),
  };
}
