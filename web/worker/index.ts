/**
 * Cloudflare Worker entry: vinext's request handler, an edge cache for the
 * expensive-but-constant OG images (lib/edgeCache.ts), Cron Triggers, and
 * Sentry error reporting.
 *
 * Each schedule in wrangler.jsonc `triggers.crons` calls an app route
 * in-process (no network hop) with the CRON_SECRET bearer token, so the
 * route keeps its own auth, idempotency and logging. Mapping and request
 * shape live in lib/workerCron.ts (unit-tested).
 *
 * Sentry is off until the SENTRY_DSN secret is set. Every event goes through
 * lib/sentryScrub.ts first (no relationship text, no personal data), with
 * breadcrumbs, request data and tracing switched off. Request errors arrive
 * via Next's onRequestError hook (instrumentation.ts → lib/errorReporting.ts);
 * each cron schedule is a Sentry cron monitor, and a non-2xx route response
 * fails its check-in.
 */
import * as Sentry from "@sentry/cloudflare";
import vinextHandler from "vinext/server/fetch-handler";
import {
  cronLog,
  cronMonitorSlug,
  cronRequest,
  CronRouteError,
  type CronEnv,
} from "../lib/workerCron";
import { edgeCacheKey, isCacheableResponse, OG_CACHE_CONTROL } from "../lib/edgeCache";
import { scrubEvent } from "../lib/sentryScrub";
import { setRequestErrorReporter } from "../lib/errorReporting";
import { canonicalRedirect } from "../lib/canonicalHost";

export * from "vinext/server/fetch-handler";

type Ctx = { waitUntil(promise: Promise<unknown>): void };
const app = vinextHandler as unknown as {
  fetch(request: Request, env: unknown, ctx: Ctx): Promise<Response>;
};

// Cloudflare's default cache (per data center). Absent in some local
// runtimes and a no-op on workers.dev; the code falls through to the app.
declare const caches: { default?: Cache } | undefined;

async function cachedFetch(request: Request, env: unknown, ctx: Ctx): Promise<Response> {
  const key = edgeCacheKey(request.method, request.url);
  const cache = typeof caches !== "undefined" ? caches?.default : undefined;
  if (!key || !cache) return app.fetch(request, env, ctx);

  const hit = await cache.match(key);
  if (hit) return hit;

  const res = await app.fetch(request, env, ctx);
  if (!isCacheableResponse(res.status, res.headers.get("content-type"))) return res;
  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", OG_CACHE_CONTROL);
  ctx.waitUntil(cache.put(key, out.clone()));
  return out;
}

type WorkerEnv = CronEnv & { SENTRY_DSN?: string; GIT_COMMIT_SHA?: string };

// Errors the app caught and rendered (route handlers, server actions,
// rendering) are reported here, tagged with the route pattern only.
setRequestErrorReporter((error, info) => {
  Sentry.withScope((scope) => {
    scope.setTag("route", info.routePath);
    scope.setTag("route_type", info.routeType);
    scope.setTransactionName(`${info.method} ${info.routePath}`);
    Sentry.captureException(error);
  });
});

const worker = {
  fetch(request: Request, env: unknown, ctx: Ctx) {
    // www → bare domain with the query string intact (lib/canonicalHost.ts).
    const canonical = canonicalRedirect(request.url);
    if (canonical) return Response.redirect(canonical, 308);
    return cachedFetch(request, env, ctx);
  },

  // Awaited (not waitUntil) so the Sentry check-in sees the outcome: a
  // non-2xx route response or a thrown error fails the tick.
  async scheduled(controller: { cron: string }, env: CronEnv, ctx: Ctx) {
    const request = cronRequest(controller.cron, env);
    if (!request) {
      console.error(JSON.stringify({ event: "cron_unknown_schedule", cron: controller.cron }));
      return;
    }
    const path = new URL(request.url).pathname;
    let res: Response;
    try {
      res = await app.fetch(request, env, ctx);
    } catch (err) {
      console.error(
        JSON.stringify({ event: "cron_tick_failed", cron: controller.cron, path, error: String(err) }),
      );
      throw err;
    }
    const line = cronLog(controller.cron, path, res.status, await res.text());
    (res.ok ? console.log : console.error)(JSON.stringify(line));
    if (!res.ok) throw new CronRouteError(path, res.status);
  },
};

// Default integrations that would copy request data, console output or
// outgoing fetch URLs into events or breadcrumbs.
const DROPPED_INTEGRATIONS = new Set(["RequestData", "Console", "Fetch"]);

export default Sentry.withSentry(
  (env: WorkerEnv) => ({
    dsn: env.SENTRY_DSN,
    release: env.GIT_COMMIT_SHA,
    environment: "production",
    // Collect nothing about the request, the user or the data. scrubEvent
    // still allowlists whatever is left.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
    tracesSampleRate: 0,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    beforeSend: (event) => scrubEvent(event),
    integrations: (defaults) => [
      ...defaults.filter((i) => !DROPPED_INTEGRATIONS.has(i.name)),
      Sentry.cronTriggersIntegration({
        monitorSlug: (cron) => {
          const slug = cronMonitorSlug(cron);
          // Hourly jobs: alert on the first failed or missed run.
          return slug
            ? { monitorSlug: slug, checkinMargin: 5, maxRuntime: 10, failureIssueThreshold: 1, recoveryThreshold: 1 }
            : undefined;
        },
      }),
    ],
  }),
  worker,
);
