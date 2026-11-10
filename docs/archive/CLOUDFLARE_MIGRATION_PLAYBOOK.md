# Vercel → Cloudflare Workers: migration playbook for Claude Code

Written Oct 11, 2026, from the Avvizo move (Next.js 14 on Vercel → Next.js 16 built with vinext on Cloudflare Workers, cut over the same week with no downtime). Reuse it for every Planetterrian project still on Vercel.

**How to use it**
1. Copy this file into the target repo as `docs/CLOUDFLARE_MIGRATION_PLAYBOOK.md` (commit it in the first PR).
2. Start a Claude Code session in that repo and paste the prompt in §0.
3. Claude Code works phase by phase and stops at every **HUMAN GATE**. The gates are the things only you can (or should) do: merges, production deploys, DNS, GitHub secrets.

---

## 0. Prompt to paste into Claude Code

> Read `docs/CLOUDFLARE_MIGRATION_PLAYBOOK.md` in full. We are moving this project off Vercel onto Cloudflare Workers, following that playbook phase by phase. Start with Phase 0 (inventory and audit) and report what you find before changing anything. Work on a branch, open draft PRs labelled `agent-generated`, and never merge. Stop at every HUMAN GATE and tell me exactly what to do, with the values to paste. Do not deploy to a production domain, change DNS, or touch secrets without my explicit go in this conversation. Keep a running status section at the top of `docs/CLOUDFLARE_MIGRATION.md` in this repo (create it from §16's template) so a later session can pick up where you left off.

---

## 1. Ground rules

- **Patrick merges every PR.** The agent opens draft PRs and drives them to green; it never merges.
- **No production change without an explicit go.** Production means: deploys to a custom domain, DNS, Worker or GitHub secrets, Supabase/Stripe settings, pausing Vercel. A `workers.dev` deploy of a branch build is fine *after* Patrick says the Cloudflare account may be used for this project.
- **No secrets in the repo, logs or PR bodies.** Print variable names, never values.
- **Record rollback before every cutover step** (DNS records, current Vercel deployment URL).
- **Keep the app buildable on the old host until DNS has moved** and run CI against both builds (§7). Rollback must stay a DNS change, not a code change.
- **Verify the old host actually works before copying its config.** On Avvizo the Vercel cron had been failing for 10 hours because a token was never set; copying "what Vercel had" would have copied the bug.
- **One validated push beats three speculative ones.** Run lint, typecheck, unit tests, and the browser suite against the Cloudflare build locally before pushing.

### What the agent can and cannot do (learned the hard way)

| Task | Agent | Notes |
|---|---|---|
| Build, test, open PRs | Yes | |
| Deploy to `*.workers.dev`, set Worker secrets, manage cron schedules | Yes, with a Cloudflare token in the session env (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) | Needs Account → Workers Scripts: Edit |
| DNS changes, attaching custom domains | Only if the token has Zone → DNS: Edit **and** the session's safety layer allows it. On Avvizo it was blocked both ways. | Plan for Patrick to do it in the dashboard: 2 minutes |
| GitHub Actions secrets and variables | **No** in cloud sessions (the proxy blocks that API) | Patrick sets them; the agent gives exact names and values to paste |
| Deleting branches | Usually blocked | Patrick deletes in GitHub → Branches |
| Supabase Auth settings (Site URL, redirect URLs, email confirmation) | No | Patrick, in the Supabase dashboard |
| Reading Vercel project settings and env **names** | Yes, via the Vercel MCP | Never decrypt values unless asked |

Cloudflare account: `756b0ae1d13eb1a4a39a8cc5d2796787` (Workers Paid is already on; the free plan's 10 ms CPU limit is too low for server rendering). Every Worker gets its own name, usually the repo name.

---

## 2. Target stack (defaults)

| Layer | Default | When to choose differently |
|---|---|---|
| Next.js app | **Next 16 + React 19, built with vinext** (Cloudflare's Vite-based implementation of the Next API) into a Worker | `npx vinext check` reports blocking issues → OpenNext (`@opennextjs/cloudflare`); same Next code, different adapter |
| Static site / Vite SPA | Worker with **Static Assets** only (`assets.directory`, `not_found_handling: "single-page-application"` for SPAs) | — |
| Astro / SvelteKit / React Router v7 / Remix | The framework's official Cloudflare adapter, deployed as a Worker | — |
| Hosting product | **Workers** (with Static Assets), not Pages | Pages only if a project already depends on it |
| Scheduled jobs | Worker **Cron Triggers** (`scheduled()` handler) | Long jobs → Cron Trigger enqueues to **Queues**; or GitHub Actions `workflow_dispatch` as Avvizo does |
| Database | Keep Supabase (HTTP via supabase-js works as-is) | Direct Postgres drivers → put **Hyperdrive** in front |
| File storage | **R2** (no egress fees) | Supabase Storage is fine where it already holds the data |
| Key-value / config / feature flags | **Workers KV** | Upstash Redis if already used (works over HTTP) |
| Rate limiting | Existing Upstash limiter, keyed on `CF-Connecting-IP` | Workers rate-limiting binding or a Durable Object for new code |
| Real-time / per-user state | **Durable Objects** | — |
| Bot protection | **Turnstile** | — |
| Analytics | GA4 as already wired; **Cloudflare Web Analytics** replaces Vercel Analytics | — |
| Images | Plain `<img>` / pre-sized assets; **Cloudflare Images** if resizing is needed | `next/image` optimization does not run under vinext |
| Errors | Sentry (works in workerd); add a source-map upload step if readable traces matter | — |
| Logs | Workers Observability (`observability.enabled: true`) + `wrangler tail` | — |
| CI/CD | GitHub Actions → `wrangler deploy` on push to `main`, after all tests | — |

---

## 3. Phase 0: inventory and audit (no changes)

Collect and write into `docs/CLOUDFLARE_MIGRATION.md`:

1. **Vercel project** (Vercel MCP: `get_project`, `list_project_domains`, env **names**): framework, Node version, root directory, build command, production branch, **every** domain (apex/www/others, and redirect-only typo domains: each one needs a home before Vercel is paused), crons, integrations (KV, Blob, Postgres, Edge Config, Analytics, Speed Insights, password protection).
2. **Repo**: framework and versions (`package.json` where the app lives), `vercel.json` (crons, redirects, headers, rewrites), `middleware.ts`, `export const runtime = "edge"`, `next/image`, `@vercel/*` packages, `process.env.VERCEL*` uses, Sentry, Stripe/Supabase/other backends, webhook routes, OG image routes, `revalidate`/ISR, server actions, file-system writes, native Node modules.
3. **Env vars**: name, where used (server vs `NEXT_PUBLIC_*` build-time), required or optional, and whether Vercel marks it sensitive. List any variable the code reads that Vercel does **not** have. That list is where silent production bugs hide.
4. **External callers**: every service that calls this app (Stripe, Twilio, Voximplant, Lulu, OAuth providers, Supabase auth redirects, uptime monitors). Note the exact URLs.
5. **DNS** (public lookup): A/AAAA/CNAME for apex and www, MX/SPF/DKIM/DMARC (must not be touched), TTLs. Is the zone already on Cloudflare? (All Planetterrian zones are expected to be.)
6. **Health of the current site**: does each cron actually succeed? Do webhooks return 2xx? Any Sentry errors? Fix or note before migrating.
7. **Things Vercel injects that won't follow you:**
   - **Marketplace integrations.** The Supabase integration on several of these projects injects `POSTGRES_*`, `SUPABASE_*` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. They are not Vercel Postgres, but they disappear with the project. Recreate the ones the code reads, by hand.
   - **System variables:** `VERCEL_*`.
   - **Deployment protection:** Vercel SSO currently guards every `*.vercel.app` URL. Use Cloudflare Access only if previews must stay private.
   - **Build settings that live in the dashboard, not the repo:** root directory, custom install and build commands (for example `pnpm --filter web build`), Node version. Vercel uses Node 24 for all these projects; Node 22 or later is fine on Cloudflare's toolchain.
   - **Vercel crons:** they are visible only in `vercel.json` or the dashboard's Cron Jobs page. A `CRON_SECRET` in env is a strong hint that crons exist.
8. **Hard-coded URLs in clients you don't redeploy:** mobile apps, OTA bundles, emails already sent, QR codes. Every one of those paths must keep working on the new host with the same response.

**HUMAN GATE 0:** Patrick reads the inventory and confirms the path (§4).

---

## 4. Phase 1: choose the path

```
Is it Next.js?
├─ yes → upgrade to Next 16 + React 19 first (Phase 2)
│        → run `npx vinext check`
│           ├─ no blocking issues → vinext            (Avvizo: 98% compatible, 0 issues)
│           └─ blocking issues    → OpenNext adapter  (needs Next ≥15.5.27 or ≥16.3.8)
├─ static export / Vite SPA → Worker + Static Assets
└─ other framework → its Cloudflare adapter
```

Keep the code standard Next.js either way, so vinext ↔ OpenNext stays an adapter swap, not a rewrite. Do **not** rewrite into a different framework to "simplify" the move.

---

## 5. Phase 2: upgrade and code changes

One PR for the Next 16 upgrade (still deployed on Vercel, behaviour unchanged), then one PR for the Cloudflare build. Each must be green and merged before the next.

### Next 14/15 → 16 checklist
- [ ] `next` 16.x, `react`/`react-dom` 19.x, `eslint-config-next` matching; Node **22** everywhere (`engines`, CI `setup-node`, `.nvmrc`). Node 20 lacks APIs the toolchain uses.
- [ ] `middleware.ts` → `proxy.ts` (same matcher, renamed export per Next 16 docs).
- [ ] `cookies()`, `headers()`, `params`, `searchParams` are async: `await` them.
- [ ] `next lint` is gone: ESLint flat config (`eslint.config.mjs`) and a `lint` script that calls `eslint` directly. Keep React Compiler rules off unless the code is ready.
- [ ] Use the public `unstable_rethrow` from `next/navigation` where errors are caught around `redirect()`/`notFound()`.
- [ ] Remove `export const runtime = "edge"` (OG images included); the Node runtime is what runs on Workers with `nodejs_compat`.
- [ ] Run the full test suite and the browser suite against `next build`.

### Cloudflare runtime fixes (apply even if tests pass)
- [ ] **Stripe webhooks**: `stripe.webhooks.constructEventAsync(...)` (Web Crypto), not `constructEvent`.
- [ ] **Client IP**: on Workers read `CF-Connecting-IP`. `X-Forwarded-For` keeps client-supplied hops there, so rate limiting on it is spoofable.
- [ ] **Outbound `fetch` to GitHub (and some other APIs)**: set a `User-Agent` header. Workers' fetch sends none, and GitHub returns 403.
- [ ] **Redirects in `next.config`**: use `permanent: true|false`; vinext ignores `statusCode`.
- [ ] **`"type": "module"` in package.json** (vinext): rename CommonJS configs (`next.config.js` → `.mjs`, `postcss.config.js` → `.cjs`, etc.).
- [ ] **No `VERCEL_*` env reads**: replace `VERCEL_URL`/`VERCEL_ENV`/`VERCEL_GIT_COMMIT_SHA` with explicit vars (`NEXT_PUBLIC_APP_URL`, `GIT_COMMIT_SHA` passed at deploy with `--var`).
- [ ] **`next/image`**: no optimizer under vinext. Use pre-sized images or `unoptimized`, or Cloudflare Images.
- [ ] **File-system writes at runtime**: not possible. Use R2, KV or the database.
- [ ] **Health route**: report the deployed commit (`GIT_COMMIT_SHA`) so every deploy is verifiable.
- [ ] **Sentry**: `@sentry/nextjs` captures errors in workerd, but its build plugin (source-map upload) does not run under Vite. Add `sentry-cli sourcemaps upload` in CI if readable traces matter.

---

## 6. Phase 3: Cloudflare build files (vinext)

Add without removing the Next build. Names below use `<worker>` for the Worker name.

**`package.json` scripts and deps**
```json
"scripts": {
  "dev:vinext": "vite dev --port 3001",
  "build:vinext": "vite build",
  "start:vinext": "wrangler dev --config dist/server/wrangler.json",
  "deploy:vinext": "wrangler deploy --config dist/server/wrangler.json"
},
"dependencies": { "vinext": "1.1.0", "@vinext/cloudflare": "1.1.0" },
"devDependencies": { "@cloudflare/vite-plugin": "<latest>", "@vitejs/plugin-react": "^5.2.0", "@vitejs/plugin-rsc": "<latest>", "wrangler": "^4.149.0" }
```
Pin exact versions that `vinext check` and the build accept; record them in the PR.

**`vite.config.ts`**: prerender static routes into Workers Static Assets. This is the single biggest performance win: it brought Avvizo's time to first byte level with Vercel's.
```ts
import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { staticAssetsAdapter } from "@vinext/cloudflare/cache/static-assets-adapter";

export default defineConfig({
  plugins: [
    vinext({ cache: { cdn: staticAssetsAdapter() }, prerender: { routes: "*" } }),
    cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] } }),
  ],
});
```

**`wrangler.jsonc`**
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "<worker>",
  "compatibility_date": "<recent date, e.g. 2026-09-15>",
  "compatibility_flags": ["nodejs_compat"],
  "main": "./worker/index.ts",
  "assets": {
    "directory": "dist/client",
    "not_found_handling": "none",
    "binding": "ASSETS",
    // Prerendered pages live here; the Worker serves them so raw cache files stay private.
    "run_worker_first": ["/_vinext/static-cache/*"]
  },
  // Only if the project has crons. Keep in sync with CRON_ROUTES in worker/index.ts.
  "triggers": { "crons": ["*/5 * * * *"] },
  "observability": { "enabled": true },
  // Add "routes" (custom domains) only in the cutover PR, AFTER DNS has moved (§11).
  "workers_dev": true,
  "preview_urls": true
}
```

**`worker/index.ts`**: vinext's handler plus a cron that calls the app's own route in-process with the cron secret, so auth, locking and logging stay in the route:
```ts
import vinextHandler from "vinext/server/fetch-handler";
export * from "vinext/server/fetch-handler";

const app = vinextHandler as unknown as { fetch(r: Request, env: any, ctx: any): Promise<Response> };
const CRON_ROUTES: Record<string, string> = { "*/5 * * * *": "/api/cron/<job>" };
const DEFAULT_ORIGIN = "https://www.<domain>";

export default {
  fetch: (req: Request, env: any, ctx: any) => app.fetch(req, env, ctx),
  async scheduled(controller: { cron: string }, env: any, ctx: any) {
    const path = CRON_ROUTES[controller.cron];
    if (!path) return console.error(JSON.stringify({ event: "cron_unknown_schedule", cron: controller.cron }));
    const headers = new Headers({ "user-agent": "<project>-cloudflare-cron" });
    if (env.CRON_SECRET) headers.set("authorization", `Bearer ${env.CRON_SECRET}`);
    const origin = (env.NEXT_PUBLIC_APP_URL || DEFAULT_ORIGIN).replace(/\/+$/, "");
    ctx.waitUntil(
      app.fetch(new Request(`${origin}${path}`, { headers }), env, ctx).then(async (res) => {
        const log = { event: "cron_tick", cron: controller.cron, path, status: res.status, body: (await res.text()).slice(0, 500) };
        (res.ok ? console.log : console.error)(JSON.stringify(log));
      }),
    );
  },
};
```
Add a unit test for the cron mapping and auth header (Avvizo: `__tests__/cron/worker-cron.test.ts`).

**Overlap safety:** while both Vercel's cron and the Worker's cron run, make the cron route idempotent per window: claim the tick in the database, or skip if a successful run happened in the last N minutes. Avvizo uses `cron_runs` plus a 3-minute dedupe. Never let two hosts double-send emails, SMS or calls.

---

## 7. Phase 4: CI

- **Node 22** in every job.
- Run the browser suite **twice** during the migration: against `next build` (fallback) and against the vinext build served by `wrangler dev` (`E2E_TARGET=vinext`, Playwright `webServer` switches command and port). Avvizo's suite caught a CSP regression and a redirect bug this way.
- `build-and-deploy` `needs:` every test job; `concurrency: { group: deploy-${{ github.ref }}, cancel-in-progress: true }` so an older run can't deploy last.
- Until cutover, gate the Cloudflare deploy on a repo variable (`CLOUDFLARE_DEPLOY == 'true'`). After cutover, remove the gate and the Vercel step, and fail fast if credentials are missing:

```yaml
      - name: Build for Cloudflare (vinext)
        run: npm run build:vinext
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_APP_URL: ${{ vars.NEXT_PUBLIC_APP_URL }}
          # ...every NEXT_PUBLIC_* the app reads (they are inlined at build time)

      - name: Check Cloudflare credentials
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: |
          if [ -z "$CLOUDFLARE_API_TOKEN" ] || [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
            echo "::error::Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID repo secrets; nothing was deployed."; exit 1
          fi
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Deploy to Cloudflare Workers
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: npx wrangler deploy --config dist/server/wrangler.json --var GIT_COMMIT_SHA:${{ github.sha }}
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          WRANGLER_SEND_METRICS: "false"
```

**HUMAN GATE (CI token):** Patrick creates a token from the **Edit Cloudflare Workers** template, adds **Zone → DNS → Edit** for the project's zone (each deploy re-asserts custom domains), and saves GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. One token per repo, so it can be revoked per project.

---

## 8. Phase 5: secrets and environment

Copy the script in **Appendix A** into the repo as `scripts/cloudflare-env.mjs`, then change `WORKER_NAME` and the `REQUIRED` list. It comes from Avvizo (`apps/web/scripts/cloudflare-env.mjs`). What it does and why:

- Patrick runs (locally, logged in to both CLIs): `npx vercel link`, `npx vercel env pull .env.cloudflare --environment=production`, then `node scripts/cloudflare-env.mjs .env.cloudflare --dry-run` (names only), then without `--dry-run` (upload), then `rm .env.cloudflare`.
- **Server variables → Worker secrets** with `npx wrangler secret bulk <file> --name <worker>`. **Always pass `--name`**: an older checkout's wrangler config may not name the Worker.
- **`NEXT_PUBLIC_*` → GitHub repo variables** (`--github` uses `gh variable set`). They are inlined at build time; setting them as Worker secrets does nothing.
- **Vercel "sensitive" variables come back as the literal string `[SENSITIVE]`** (older CLIs: empty). The script lists them and **never uploads them**. Patrick sets each with `npx wrangler secret put NAME --name <worker>`. Uploading the placeholder would silently break webhooks.
- Skip `VERCEL*`, `TURBO_*`, `NX_*`, and unused `POSTGRES_*`.
- Keep a `REQUIRED` list in the script; it reports any required variable missing from Vercel (that is how Avvizo found `GITHUB_DISPATCH_TOKEN` had never been set).
- The agent can list Worker secret **names** with the API to confirm the count matches.

---

## 9. Phase 6: first deploy to workers.dev and verification

**HUMAN GATE:** go for a first deploy to `<worker>.<subdomain>.workers.dev`. Nothing public points at it yet.

Build and deploy (agent, with the session token):
```bash
NEXT_PUBLIC_...=... npm run build:vinext
npx wrangler deploy --config dist/server/wrangler.json --var GIT_COMMIT_SHA:<sha>
```
The first deploy of a new Worker can take a minute or two to answer on workers.dev; wait before calling it broken.

Verify on workers.dev and write the results in the PR:
- [ ] Every public page returns 200; `/does-not-exist` returns the branded 404.
- [ ] Sign-in works and the dashboard loads (sessions are host-specific, so test on the same host).
- [ ] Security headers and CSP present; no console errors on key pages.
- [ ] Each webhook route answers an **unsigned** POST with 400/401/403, never 404 or 500.
- [ ] Health route returns the deployed commit.
- [ ] Sentry receives a test event from the Worker.
- [ ] **Cron:** `wrangler tail` shows `cron_tick` with status 200 within one interval, and the app's own run log has rows. **If a brand-new cron never fires**, clear and re-add the schedule:
  `PUT /accounts/{account}/workers/scripts/<worker>/schedules` with `[]`, then with `[{"cron":"*/5 * * * *"}]`. That fixed Avvizo's silent cron.
- [ ] Time to first byte for the top pages compared with Vercel (5 requests each, median). Expect parity for prerendered pages.

---

## 10. Phase 7: optimize

In order of payoff:
1. **Prerender everything static** (§6). Check the build output lists the routes you expect as prerendered; a route that reads cookies or headers at the top level will not prerender. Move per-user reads into client components or dynamic segments.
2. **Cache headers** on static assets (hashed files: `public, max-age=31536000, immutable`); HTML from the prerender cache is replaced by each deploy.
3. **Smart Placement** (`"placement": { "mode": "smart" }`) when most requests make several round-trips to one backend region (e.g. Supabase us-west-2). Measure TTFB for a signed-in page before and after; keep it only if it helps.
4. **CPU time**: watch Workers metrics for p99 CPU on server-rendered routes. Heavy work (PDFs, image processing, AI calls with long waits) belongs in Queues or a background job, not the request.
5. **Bundle size**: keep the Worker well under the size limit; dynamic-import heavy server-only libraries.
6. **Database connections**: supabase-js over HTTP needs nothing. Direct Postgres (pg, Drizzle, Prisma) → Hyperdrive.
7. **Turn off what you don't use**: `preview_urls` if PR previews aren't wanted; the Next fallback CI job once the project has been stable on Cloudflare for a month.

---

## 11. Phase 8: DNS cutover (HUMAN GATE)

Before: write the current records (apex, www, any app/subdomain) into the rollback table in `docs/CLOUDFLARE_MIGRATION.md`. Confirm MX/SPF/DKIM/DMARC records will not be touched.

**www (or the main host) first.** In the Cloudflare dashboard, back to back:
1. DNS → Records: delete the `www` CNAME that points to Vercel (`*.vercel-dns*.com`).
2. Workers & Pages → `<worker>` → Settings → Domains & Routes → Add → Custom domain → `www.<domain>`. Cloudflare creates the proxied record and certificate itself (about a minute).

Order matters: Cloudflare refuses the custom domain while the old record exists (API error 100117). www is unreachable for the minute in between.

The agent then verifies on the real domain: pages, sign-in, webhooks (unsigned POSTs), health, cron rows, Sentry. **Vercel stays deployed** during this.

**Apex after a clean day.** Delete the apex `A` record (`216.150.1.1` is Vercel's), add the apex as a custom domain. The app (or `proxy.ts`) redirects apex → www with a permanent redirect.

**Old subdomains** (like `app.<domain>` on Vercel): delete once nothing uses them. Check the code, auth redirect URLs and email links first.

**Then, in a PR:** add both custom domains to `wrangler.jsonc` so deploys keep them:
```jsonc
"routes": [
  { "pattern": "www.<domain>", "custom_domain": true },
  { "pattern": "<domain>", "custom_domain": true }
]
```

**External callers:** update anything that pointed at a Vercel URL (`*.vercel.app`, old subdomains). Webhooks on the same custom domain need no change.

**Zone settings (HUMAN):** SSL/TLS → Edge Certificates → **Always Use HTTPS: On** (Vercel always forced HTTPS; Cloudflare doesn't by default). Check that `http://` 301s to `https://` on every host.

**Supabase Auth (HUMAN):** Authentication → URL Configuration: Site URL and redirect URLs on the final host.

**Rollback:** remove the Worker's custom domain, recreate the recorded Vercel record (DNS only), unpause Vercel if paused. TTL is minutes.

---

## 12. Phase 9: retire Vercel

After the Worker's cron and pages have run cleanly for a day on the real domain:
- **HUMAN:** pause the Vercel project and disconnect it from GitHub (Settings → Git). Keep it 30 days, then delete it.
- **PR (agent):** remove `vercel.json` (after confirming the Worker covers its crons, redirects and headers), remove the Vercel deploy step and the `CLOUDFLARE_DEPLOY` gate, add the credentials check, update README/AGENTS/CLAUDE docs and `.env.example` files (no "set it in Vercel" instructions left), update the runbook status.
- **HUMAN housekeeping:** delete GitHub secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` and variable `CLOUDFLARE_DEPLOY`; delete stale branches.
- **Agent, after the merge:** confirm the main deploy succeeded, the new version is live, the custom domains are still attached, and the first cron tick after the deploy ran.

---

## 13. Vercel feature → Cloudflare replacement

| Vercel | Cloudflare | Notes |
|---|---|---|
| Serverless / Edge Functions | The Worker itself | One runtime; `nodejs_compat` gives Node APIs |
| Vercel Cron (`vercel.json` `crons`) | Cron Triggers + `scheduled()` | §6; dedupe during overlap |
| ISR / static generation | vinext prerender + `staticAssetsAdapter` | A deploy refreshes the cache |
| `next/image` optimization | Pre-sized images, or Cloudflare Images | |
| `@vercel/og` / `next/og` | Works in the Worker (Node runtime) | Remove `runtime = "edge"` |
| Vercel KV | Workers KV, or keep Upstash (HTTP) | |
| Vercel Blob | R2 | |
| Vercel Postgres (Neon) | Keep Neon/Supabase; Hyperdrive for direct drivers | |
| Edge Config | Workers KV | |
| Vercel Analytics / Speed Insights | Cloudflare Web Analytics; keep GA4 | |
| Password protection / preview protection | Cloudflare Access | |
| Preview deployments | `preview_urls: true` + `wrangler versions upload` per PR (optional) | |
| `VERCEL_URL`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA` | Explicit vars; `--var GIT_COMMIT_SHA:<sha>` | |
| Vercel env UI | Worker secrets (server) + GitHub variables (`NEXT_PUBLIC_*`) | |
| Vercel firewall / attack mode | Cloudflare WAF, rate-limiting rules, Bot Fight Mode | Zone-level |

---

## 14. Pitfalls from the Avvizo move (symptom → cause → fix)

| Symptom | Cause | Fix |
|---|---|---|
| New Cron Trigger never fires | Brand-new schedule did not register | Clear and re-add via the schedules API (§9) |
| Cron fires, GitHub API returns 403 | Workers `fetch` sends no User-Agent | Set `User-Agent` on every GitHub call |
| Cron runs but nothing happens, for hours | Required token never set on the old host either | Audit required env in Phase 0; alert on failed ticks (heartbeat) |
| Webhook signature failures after copying env | `[SENSITIVE]` placeholder uploaded as the value | Never upload placeholders; set sensitive values by hand |
| `wrangler secret ...` "Required Worker name missing" | Running from a checkout whose config lacks `name` | Always pass `--name <worker>` |
| Redirect returns 307 instead of 301/308 | vinext ignores `statusCode` | `permanent: true` |
| CI fails on `fs/promises` glob | Node 20 | Node 22 everywhere |
| Stripe webhook verification fails on Workers | Sync crypto in `constructEvent` | `constructEventAsync` |
| Rate limiter keyed on spoofable IP | `X-Forwarded-For` on Cloudflare | `CF-Connecting-IP` |
| Custom domain attach fails (100117) | Old DNS record still present | Delete record, then add custom domain (or token with DNS Edit + override) |
| Typecheck fails locally with `.next/types` errors | Stale `next build` output | `rm -rf .next` |
| E2E ran against the wrong server | A previous server still bound the port | Kill by PID (never `pkill -f` a pattern that matches your own shell) |
| Playwright "executable doesn't exist" in cloud sessions | Version mismatch with preinstalled Chromium | `launchOptions.executablePath: "/opt/pw-browsers/chromium"` in a local config |
| Deploy build failed once on `next/font/google` | Transient font fetch | One re-run; if it repeats, self-host the font |
| A merged PR's follow-up landed on the wrong base | Branch reused after merge | Restart the branch from `origin/main` after every merge |
| A prerendered page redirects to the homepage on Cloudflare (lil words `/delete-account`) | A `_redirects` rule `/x /index.html 200` (a leftover from Pages/Vercel-era SPA rewrites). Workers Static Assets apply `_redirects` **before** serving files, then `html_handling` redirects `/index.html` to `/` | Remove 200 rewrites for paths that exist as files; let `not_found_handling: "404-page"` replace `/* /404.html 404`. Test every rewritten path locally with `wrangler dev` |
| `/page/` now redirects where Vercel served 200 | `html_handling` modes differ from Vercel's directory serving | Choose the mode that matches the canonical tags (`drop-trailing-slash` for canonicals without a slash) and record the difference |
| Agent PR fails the repo's agent-guard check | The migration touches protected paths (`.github/workflows/`, `vercel.json`) | Keep those changes in a separate PR that Patrick approves knowingly; everything else goes in agent PRs |
| Wrangler dev "Address already in use" after a restart | The old `workerd` child outlived `wrangler` | Kill `workerd` too (`pkill -f "[w]orkerd"`) before restarting |
| Native app code treats an unset key as "configured" (lil words RevenueCat) | GitHub won't store an empty variable, so a placeholder like `1` was saved and inlined at build | Delete the variable instead (unset `vars.X` builds as empty). Grep the built bundle for the inlined value before cutover |
| Deleting a bad variable doesn't fix production | Build-time values only change on the next build | Redeploy after changing any build variable. When an OTA bundle carries it, publish a new version (a new commit), not a re-run of the same one |
| The main site goes into a redirect loop after adding a typo-domain redirect (superpools) | A Redirect Rule matching all requests was created in the **main** domain's zone, pointing back at the typo domain | Create each redirect rule in the zone of the domain being redirected **away from**, and match on hostname. Test the main domain immediately after adding any rule |
| `http://` pages load without upgrading to HTTPS (all four zones, Oct 11) | Vercel always forced HTTPS; the Cloudflare zone setting "Always Use HTTPS" defaults to off | Turn on SSL/TLS → Edge Certificates → Always Use HTTPS in every zone during cutover (add HSTS once stable) |
| Redirect-only domains (typo or old brand) break when Vercel is paused (superpools: 503) | Vercel served their 308s, so they look "migrated" when the main domain is | Inventory every domain on the Vercel project, not only the canonical one. Redirect-only domains need a zone Redirect Rule plus a proxied placeholder record (`A @ 192.0.2.1`, proxied) |
| The bare domain shows Vercel IPs but the dashboard has no A record (lil words) | Vercel apex records are often a CNAME that Cloudflare flattens | Delete the apex CNAME, then attach the apex as a custom domain; add a zone Redirect Rule (308, preserve query string) so it never serves pages itself |
| A just-updated `latest.json` points at a zip that briefly 404s | A new Worker version spreads over a few seconds, so consecutive requests can hit different versions | Harmless when the client validates the download (Capacitor Updater fails to unzip HTML and retries next launch); otherwise publish the bundle before the manifest |
| Removing `vercel.json` still builds on Vercel | The Vercel project keeps its own dashboard build settings | Pause and disconnect Git anyway, so nothing deploys from Vercel after the cutover |

---

## 15. Done criteria (per project)

- [ ] All production hostnames are Worker custom domains and declared in `wrangler.jsonc`.
- [ ] Every merge to `main` deploys the Worker after all tests; the health route shows the new commit.
- [ ] Crons run only on Cloudflare and are verified in the app's run log; a heartbeat alerts if they stop.
- [ ] Webhooks, sign-in, email links and auth redirects use the final host.
- [ ] TTFB on top pages is at or below Vercel's; static pages are prerendered.
- [ ] Sentry receives errors from the Worker.
- [ ] Vercel paused (deleted after 30 days), its secrets removed, `vercel.json` gone, docs updated.
- [ ] `docs/CLOUDFLARE_MIGRATION.md` records decisions, rollback values and status.

---

## 16. Template for the per-repo `docs/CLOUDFLARE_MIGRATION.md`

```markdown
# Moving <project> from Vercel to Cloudflare Workers

Status (<date>): Phase <n> — <one line>.
Worker: `<worker>` · workers.dev URL: <url> · Path: vinext | OpenNext | static | <adapter>

## Inventory
<Phase 0 findings: framework, versions, domains, crons, env names (server / NEXT_PUBLIC / sensitive / missing), integrations, external callers>

## Decisions
<path chosen and why; anything deferred>

## DNS before the switch (rollback)
| Host | Record |
|---|---|

## Steps and verification log
<dated entries: what was done, by whom, what was checked>

## Rollback
<exact steps for this project>
```

---

## 17. Order for the remaining projects

Inventory from Vercel on Oct 11, 2026 (status updated the same evening). It covers 8 projects, all with production branch `main`. Repo internals (`vercel.json`, `next/image`, `@vercel/*`) still need Phase 0 in each repo. Do one project at a time, lowest risk first, and carry each project's new lessons back into §14.

| # | Vercel project → repo | Stack today | Domains | Risk | Notes |
|---|---|---|---|---|---|
| 1 | lilwords → `Planetterrian/lilwords` | **Done 2026-10-11.** Assets-only Worker `lilwords`, CI deploys, Vercel paused | www.lilwords.com (bare domain 308s to www through a Redirect Rule) | Done | Record: `docs/CLOUDFLARE_MIGRATION.md` in the repo. Left: OTA check on a device, delete the Vercel project after 2026-11-10. |
| 2 | superpools → `patricknovak/sak` | **On Cloudflare** (Workers `superpools-landing` and `superpools-app`; `sak.superpoolsai.com` is a custom domain of `superpools-app`) | superpoolsai.com and www serve from Cloudflare (www serves 200 with an apex canonical; it used to 308). **The typo domains superpoolai.com and www.superpoolai.com still pointed at Vercel and returned 503 on 2026-10-11.** | Low | Fix: Redirect Rule plus proxied placeholder records in the `superpoolai.com` zone (308 → superpoolsai.com). Optionally restore www → apex 308 in the `superpoolsai.com` zone. Then delete the Vercel project. |
| 3 | liogon-financial-web → `Planetterrian/LiogonFinancial` | Next 16.2.10, app in `apps/web`, 3 env vars, Sentry, tesseract assets copied at prebuild | www.liogon.com (apex 308 → www) | Low–medium | Already on Next 16. Check the tesseract worker/wasm assets are served from Static Assets with the right content type. |
| 4 | emaofbc → `Planetterrian/Emaofbc` | Next 14.2, middleware (Supabase in edge), Stripe, Resend, `CRON_SECRET` | none (vercel.app only) | Low business risk | Next 16 upgrade first. No DNS step: pick a domain or keep the workers.dev URL. A `.env.production` file is committed; check it for secrets and remove them. |
| 5 | relationship-copilot → `patricknovak/relationship-copilot` | Next 15.5, middleware, an edge route (likely OG image), Stripe, Supabase integration vars, xAI | relationshipcopilot.com (apex canonical, www 308 → apex) | Medium | Next 16 upgrade first. Here the **apex** is the main host: move it first, www second. |
| 6 | aiimpact-web → `patricknovak/aiimpact` | Next 14.2, middleware, pnpm monorepo (`pnpm --filter web build`), Supabase integration vars | aiimpact.ca and www.aiimpact.ca, both serving, no redirect | Medium | Next 16 upgrade first. Choose one canonical host and redirect the other. Stripe routes exist but no Stripe env vars: checkout is probably broken today. Decide before migrating. |
| 7 | loansexpert → `patricknovak/Loansexpert` | Next 14.2, 166 kB middleware, `instrumentationHook`, `unpdf`, 147 routes, `CRON_SECRET` | www.loansexpert.ca (apex → www) | Medium–high | Next 16 upgrade first (drop the `instrumentationHook` flag). Check PDF parsing works in workerd and stays within CPU limits; move it to a Queue if not. |
| 8 | billsaved → `patricknovak/billsaved` | Next 16.2, proxy, Sentry (`runAfterProductionCompile`), Upstash, Turnstile, VoxImplant WebRTC, ~73 env vars, 6 `HEARTBEAT_*` jobs | www.billsaved.com (apex 308 → www) | High | Revenue product with live calls: do it last, after the playbook has been proven on four or five projects. Get the full env and cron list from the repo and dashboard first. Each heartbeat job needs a Cron Trigger (or its external pinger repointed). |

Before starting each repo, add it to the Claude Code session (cloud sessions only see the repos attached at start).

---

## 18. lil words: specific notes (first project)

Paste this after the §0 prompt:

> This is lil words, a Vite + React SPA in a pnpm monorepo (app in `apps/web`). It has no server code and 4 build-time `VITE_*` variables. Target: a Worker with Static Assets only (no Worker script unless redirects require one). Do Phase 0 first and pay special attention to the OTA bundle under `/ota/`, which the mobile app downloads from `https://www.lilwords.com/ota/...`.

What to get right:
- **Build:** reproduce Vercel's install and build commands exactly, including the prebuild and postbuild scripts and the pnpm version (`packageManager` field). The CI step is `pnpm install --frozen-lockfile` then the same build. `assets.directory` is the built `dist`.
- **Lessons from doing it (Oct 11):** the repo's `_redirects` rewrite for `/delete-account` broke that page on Workers (see §14); it was removed and `check-spa-routing.mjs` now guards the Workers config. Vercel caches even a missing `/assets/*` file for a year, and the Workers `_headers` rule does the same, so behaviour is unchanged.
- **SPA fallback without breaking OTA:** use `not_found_handling: "single-page-application"` for app routes. A missing `/ota/...` file must still return **404**, not `index.html` with 200, or the mobile app may install HTML as a bundle. Either:
  - serve OTA from a path excluded from the fallback via `run_worker_first: ["/ota/*"]` and a tiny Worker that returns 404 when the asset is missing, or
  - move OTA files to **R2** behind the same URL (also the better long-term home for versioned bundles).

  Verify with a `curl` of a real OTA file (same bytes and `content-type` as on Vercel) and of a missing one (404).
- **Prerendered marketing pages:** confirm they are in `dist` as real HTML files and served as such, not replaced by the SPA shell. Check titles and meta in `curl` output.
- **Headers and redirects:** port anything in `vercel.json` (`headers`, `redirects`, `rewrites`) to a `_headers`/`_redirects` file in the assets directory (Workers Static Assets supports both) or to the Worker. Apex → www 308: a Cloudflare zone Redirect Rule, or a two-line Worker check.
- **Cache headers:** hashed assets `immutable`. OTA manifests and `index.html` must not be cached long, or users get stale bundles. Copy whatever `Cache-Control` Vercel sends today for each path type (check with `curl -I`).
- **Env:** the four `VITE_*` values become GitHub variables used at build time. The RevenueCat keys are public SDK keys, but treat them as config, not code. Nothing goes into Worker secrets.
- **DNS:** www first (custom domain on the Worker), apex the next day, per §11.
- **Done means:**
  - The web app, marketing pages and OTA downloads work on www.lilwords.com.
  - The mobile app pulls an OTA update from the new host on a real device.
  - Vercel is paused.

---

## Appendix A: `scripts/cloudflare-env.mjs`

Set `WORKER_NAME` and `REQUIRED` for the project. If the package is not `"type": "module"`, keep the `.mjs` extension.

```js
#!/usr/bin/env node
/**
 * One-time copy of the web app's environment from Vercel to Cloudflare.
 *
 * Usage (from apps/web, logged in to the Vercel and Cloudflare CLIs):
 *
 *   npx vercel env pull .env.cloudflare --environment=production
 *   node scripts/cloudflare-env.mjs .env.cloudflare --dry-run   # names only
 *   node scripts/cloudflare-env.mjs .env.cloudflare             # upload
 *   rm .env.cloudflare
 *
 * What it does:
 *   - Server variables (everything except NEXT_PUBLIC_*, Vercel system and
 *     unused Vercel Postgres variables) go to the Worker with
 *     `wrangler secret bulk`. Secrets persist across deploys.
 *   - NEXT_PUBLIC_* values are inlined at build time, so the Worker cannot
 *     use them at runtime. They go to GitHub repo variables (read by the
 *     deploy workflow) with `gh variable set` when --github is passed;
 *     otherwise the script prints the names to set.
 *   - Variables Vercel marks "sensitive" come back from `env pull` as the
 *     placeholder "[SENSITIVE]" (older CLIs: empty). They are listed and
 *     never uploaded; set them with `npx wrangler secret put NAME`.
 *
 * No value is ever printed.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Server variables the deployed app cannot run without. */
const REQUIRED = [
  "CRON_SECRET",
  "GITHUB_DISPATCH_TOKEN",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "VOXIMPLANT_WEBHOOK_SECRET",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "RESEND_API_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

const SKIP_PREFIXES = ["VERCEL", "TURBO_", "NX_", "POSTGRES_"];

/** The Worker in wrangler.jsonc. Named explicitly so the upload does not
 *  depend on which commit (and wrangler config) the local checkout has. */
const WORKER_NAME = "avvizo-web";

/** What `vercel env pull` writes instead of a sensitive value. */
const VERCEL_SENSITIVE_PLACEHOLDER = "[SENSITIVE]";

/** True when the pulled value is not a real value (empty or placeholder). */
function isUnpulledValue(value) {
  const v = (value ?? "").trim();
  return v === "" || v === VERCEL_SENSITIVE_PLACEHOLDER;
}

/** Minimal dotenv parser for `vercel env pull` output (KEY="value"). */
export function parseDotenv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2];
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    out[m[1]] = value;
  }
  return out;
}

/** Split pulled variables into Worker secrets, public build vars, empties. */
export function classify(vars) {
  const secrets = {};
  const publicVars = {};
  const empty = [];
  for (const [key, value] of Object.entries(vars)) {
    if (SKIP_PREFIXES.some((p) => key.startsWith(p))) continue;
    if (isUnpulledValue(value)) {
      empty.push(key);
      continue;
    }
    if (key.startsWith("NEXT_PUBLIC_")) publicVars[key] = value;
    else secrets[key] = value;
  }
  const missing = REQUIRED.filter((k) => !(k in secrets));
  return { secrets, publicVars, empty: empty.sort(), missing };
}

function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const toGithub = args.includes("--github");
  if (!file) {
    console.error("Usage: node scripts/cloudflare-env.mjs <pulled .env file> [--dry-run] [--github]");
    process.exit(2);
  }

  const { secrets, publicVars, empty, missing } = classify(parseDotenv(readFileSync(file, "utf8")));

  console.log(`Worker secrets (${Object.keys(secrets).length}): ${Object.keys(secrets).sort().join(", ")}`);
  console.log(`Build-time NEXT_PUBLIC_* (${Object.keys(publicVars).length}): ${Object.keys(publicVars).sort().join(", ")}`);
  if (empty.length) {
    console.log(`\nNot pulled (Vercel "sensitive": empty or [SENSITIVE]); set by hand with \`npx wrangler secret put NAME\`:\n  ${empty.join("\n  ")}`);
  }
  if (missing.length) {
    console.log(`\nRequired but not in the pull (set before cutover):\n  ${missing.join("\n  ")}`);
  }
  if (dryRun) return;

  const dir = mkdtempSync(path.join(tmpdir(), "avvizo-cf-"));
  const secretsFile = path.join(dir, "secrets.json");
  try {
    writeFileSync(secretsFile, JSON.stringify(secrets), { mode: 0o600 });
    execFileSync("npx", ["wrangler", "secret", "bulk", secretsFile, "--name", WORKER_NAME], {
      stdio: "inherit",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  if (toGithub) {
    for (const [key, value] of Object.entries(publicVars)) {
      execFileSync("gh", ["variable", "set", key, "--body", value], { stdio: ["ignore", "inherit", "inherit"] });
    }
    console.log("GitHub repo variables set.");
  } else if (Object.keys(publicVars).length) {
    console.log("\nSet these as GitHub repo variables (Settings → Secrets and variables → Actions → Variables), or rerun with --github.");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
```
