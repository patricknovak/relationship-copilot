/**
 * Cloudflare Worker entry: vinext's request handler, an edge cache for the
 * expensive-but-constant OG images (lib/edgeCache.ts), and Cron Triggers.
 *
 * Each schedule in wrangler.jsonc `triggers.crons` calls an app route
 * in-process (no network hop) with the CRON_SECRET bearer token, so the
 * route keeps its own auth, idempotency and logging. Mapping and request
 * shape live in lib/workerCron.ts (unit-tested).
 */
import vinextHandler from "vinext/server/fetch-handler";
import { cronLog, cronRequest, type CronEnv } from "../lib/workerCron";
import { edgeCacheKey, isCacheableResponse, OG_CACHE_CONTROL } from "../lib/edgeCache";

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

const worker = {
  fetch(request: Request, env: unknown, ctx: Ctx) {
    return cachedFetch(request, env, ctx);
  },

  async scheduled(controller: { cron: string }, env: CronEnv, ctx: Ctx) {
    const request = cronRequest(controller.cron, env);
    if (!request) {
      console.error(JSON.stringify({ event: "cron_unknown_schedule", cron: controller.cron }));
      return;
    }
    const path = new URL(request.url).pathname;
    ctx.waitUntil(
      app
        .fetch(request, env, ctx)
        .then(async (res) => {
          const line = cronLog(controller.cron, path, res.status, await res.text());
          (res.ok ? console.log : console.error)(JSON.stringify(line));
        })
        .catch((err) => {
          console.error(
            JSON.stringify({ event: "cron_tick_failed", cron: controller.cron, path, error: String(err) }),
          );
        }),
    );
  },
};

export default worker;
