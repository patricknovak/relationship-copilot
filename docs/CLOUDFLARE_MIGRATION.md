# Moving relationshipcopilot.com from Vercel to Cloudflare Workers

Status (2026-10-16): **Cutover code is complete** (PRs #82/#83 merged). The Worker is live on `workers.dev` and matches Vercel. Production still runs on Vercel. Three things only Patrick can do stand between here and the cutover (§5):
1. Paste five server secrets into the Worker.
2. Swap DNS to the Worker (the agent's Cloudflare token has no DNS permission).
3. Add two GitHub secrets so CI deploys on merge.

Worker: `relationship-copilot` · Path: **vinext** (`vinext check`: 98% compatible, 0 issues) · Playbook: `docs/CLOUDFLARE_MIGRATION_PLAYBOOK.md`.

## 1. Inventory (Phase 0)

| Item | Finding |
|---|---|
| Vercel project | `relationship-copilot` (`prj_OKbm6q58LX5tNXOg5AKvP5tLH1PW`). Production branch `main`. Node 24. Builds `web/`. |
| App | Next.js 15.5 → **16.4** in this branch. React 19.3, App Router. 19 pages, 4 route handlers, plus OG images, sitemap, robots and manifest. Supabase SSR auth. Stripe. xAI. GA4 Measurement Protocol via `after()`. |
| `vercel.json` / crons | None on Vercel. The hourly daily-reminder email (`/api/cron/daily-reminder`) was planned as pg_cron + pg_net; it is now a Worker Cron Trigger (§2). |
| Proxy | `middleware.ts` → `proxy.ts`: Supabase session refresh, then the enforced CSP (per-request script nonce) and security headers. |
| Edge runtime | The two OG images declared `runtime = "edge"`. Removed; they render on the Node runtime, and both return 200 on the Worker. |
| Stripe webhook | Already `constructEventAsync`. Verified in workerd: a bad signature returns 400 and a valid one returns 200. |
| Turnstile | The login widget's hostname list is `relationshipcopilot.com` only. **Magic-link sign-in can't be tested on `workers.dev`**; test it on the real domain after the cutover. The site key is built in, and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is an optional override. |
| Env read by code | **Server**: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `XAI_API_KEY`, `XAI_MODEL`, `XAI_BASE_URL`, `XAI_NO_TRAINING_DPA`, `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`, and (optional, notifications) `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `NOTIFY_SECRET`. **Build-time**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_STRIPE_PRICE_PREMIUM`, `NEXT_PUBLIC_AUTH_PROVIDERS`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_GTM_ID`. The Vercel Supabase integration also injects `POSTGRES_*`, `SUPABASE_*` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, which the app doesn't read; the env script skips them. |
| Domains | `relationshipcopilot.com` is canonical (the bare domain). `www` 308s to it, both in Vercel Domains and in `next.config.mjs` `redirects()`. |
| DNS (zone `0dddda8d6ff408af498a086d8749a1cc`, already on Cloudflare) | See §4. Email routing MX on the bare domain; `www` has an MX to `mx.relationshipcopilot.com`. Leave both alone. |
| HSTS | Vercel sends `strict-transport-security: max-age=63072000` (2 years). The app now sends the same header itself (`lib/securityHeaders.ts` and `next.config.mjs`, kept in lockstep by a test), so nothing changes at cutover and no zone setting is needed. |
| CI | `.github/workflows/web-ci.yml`: typecheck, test, build, plus a Postgres job for migrations and RLS. This branch adds lint, the Cloudflare build and the gated `deploy-cloudflare` job. |

## 2. Decisions and changes in this branch

- **Next 16:**
  - `middleware.ts` → `proxy.ts`.
  - `next lint` → ESLint flat config (`eslint.config.mjs`). React Compiler rules are off, including the new `react-hooks/refs`, which flagged the Turnstile widget's ref pattern. Behaviour is unchanged.
  - `runtime = "edge"` removed from the OG images.
- **The `postcss` override `$postcss` is pinned to `^8.5.28`** (same range). npm refused to add packages with the `$` reference.
- **vinext build:**
  - `vite.config.ts` with the prerender cache (see the optimizations below for what prerenders).
  - `wrangler.jsonc`.
  - `worker/index.ts`: vinext's handler, plus the cron and edge-cache wrappers added below.
  - `"type": "module"`.
  - Scripts `build:vinext`, `start:vinext` and `deploy:vinext`.
  - `next build` still works, so Vercel stays the fallback.
- **Local gotcha:** run `rm -rf .next` between `npm run build` and `npm run build:vinext` before `npm run typecheck`. vinext rewrites `.next/types/routes.d.ts`, which clashes with `next build`'s validator. CI typechecks a fresh tree first, so it isn't affected.
- **CI:** Lint plus the Cloudflare build on every PR. `deploy-cloudflare` runs on push to `main` only when `vars.CLOUDFLARE_DEPLOY == 'true'`, and fails fast without the Cloudflare secrets.
- **`web/scripts/cloudflare-env.mjs`:** copies Vercel's production **server** env to Worker secrets without printing values (playbook §8). `NEXT_PUBLIC_*` stay in `web/.env.production` — the script does not push them to GitHub Actions variables (empty GH vars would override the file).

- **Cutover branch (`claude/cloudflare-cutover`):**
  - `web/.env.production` holds the public `NEXT_PUBLIC_*` build values (Supabase URL and anon key, site URL, Stripe price, auth providers, GTM). They ship in the browser bundle anyway; the values were checked against Vercel's live bundles. CI no longer passes them as repo variables, because an unset variable arrives empty and overrides the file.
  - `wrangler.jsonc` sets non-secret `vars` (`APP_ORIGIN`, `GA4_MEASUREMENT_ID`, `EMAIL_FROM`) on every deploy. Secrets are set once and persist across deploys.
  - **Cron:** `triggers.crons = ["20 * * * *", "40 * * * *"]` (daily reminder; "still your turn" follow-up). `worker/index.ts` `scheduled()` calls `/api/cron/daily-reminder` in-process with `CRON_SECRET`, inside `waitUntil`, and logs one JSON line per tick (`cron_tick` or `cron_tick_failed`). The mapping is in `lib/workerCron.ts`, and a test checks it against `wrangler.jsonc`. No pg_cron job or SQL secret is needed.
  - **`/api/health`** returns `{ ok, commit }` with no-store, so a deploy can be checked from outside.
  - **HSTS** is app-owned (see §1).
- **Cloudflare optimizations:**
  - **Prerendering.** The header and the public pages no longer read cookies. A tiny inline script (`lib/authHint.ts`) sets `<html data-auth="in">` before first paint when a Supabase session cookie exists, and CSS shows the matching nav and CTAs. It is a display hint only; every protected route is still checked on the server. 13 routes now prerender (`/`, `/about`, `/privacy`, `/safety`, `/terms`, the seven `/for/*` pages, not-found), up from one, and are served from the static cache (`x-vinext-cache: HIT`) with the proxy's headers still applied.
  - **Login redirects keep the query string.** `/connections/new?type=sibling` now round-trips through `/login?next=…`.
  - **Placement** is targeted at the Supabase host, so the Worker runs next to the database (`cf-placement: local-IAD`).
  - **OG image edge cache.** vinext renders the two OG images on every request (1–2.5 s of WASM). `worker/index.ts` caches successful image responses in the Cache API for 7 days, keyed by the App Router content hash; all invite codes share one key because the invite image never varies by code (`lib/edgeCache.ts`). The Cache API is a no-op on `workers.dev`, so the first HIT can only be seen on the real domain.

## 3. URL parity (live Vercel vs. the deployed Worker on `workers.dev`)

| Path | Vercel | Worker |
|---|---|---|
| `/`, `/about`, `/pricing`, `/privacy`, `/terms`, `/safety`, `/library`, `/login` | 200 | 200 |
| `/account`, `/connections`, `/onboarding` | 307 → `/login?next=…` | same |
| `/auth/confirm` (no token) | 307 → `/login?error=auth` | same |
| `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/icon.svg`, `/opengraph-image` | 200 | 200 |
| `/nope` | 404 | 404 |
| `www.` host | 308 → bare domain | 308 → bare domain (`next.config` redirect) |
| `/for/*`, `/invite/<code>` | 200 | 200 |
| `/api/health` | 404 (new route) | 200 with the deployed commit |
| `POST /api/cron/daily-reminder`, no auth | 401 | 401 |
| `POST /api/stripe/webhook`, unsigned | 400 | 500 today because `STRIPE_WEBHOOK_SECRET` isn't set yet; 400 once it is |
| Security headers incl. HSTS | baseline | identical (the Worker also drops `x-powered-by`) |

Time to first byte after TLS, median of interleaved runs from one client on 2026-10-14:

| Request | Vercel | Worker (`workers.dev`) |
|---|---|---|
| `/icon.svg` (network baseline) | ~48 ms | ~103 ms |
| Pages | ~100–115 ms | ~110–135 ms |

The baseline gap is the network path to `workers.dev`, not app code. Subtracting it, the Worker spends ~10–30 ms in the app against Vercel's ~55–65 ms, so parity or better is expected on the real domain, where Cloudflare already terminates TLS.

## 4. DNS before the switch (rollback)

Read from public DNS on 2026-10-14. All records are DNS-only. Vercel's IPs changed between 2026-10-11 (`.129`) and 2026-10-14 (`.193`), so for a rollback use whatever Vercel → Project → Settings → Domains shows at the time; the values below are only a reference.

| Host | Record |
|---|---|
| `relationshipcopilot.com` | `A 216.150.16.193`, `A 216.150.1.193` (Vercel; possibly a flattened CNAME, so check the dashboard) |
| `www.relationshipcopilot.com` | `CNAME dbcc9a4ca41351c1.vercel-dns-016.com` |

## 5. Steps (gates marked **Patrick**)

Done: test deploy to `relationship-copilot.patricknovak1.workers.dev`, parity checks (§3), cron trigger registered, `CRON_SECRET` and `NOTIFY_SECRET` minted and set on the Worker.

1. **Patrick, Worker secrets.** Vercel marks these sensitive, so they can't be copied out. Paste each from its source (Supabase → API, Stripe → Developers, xAI console, GA4 → Measurement Protocol) in Cloudflare → Workers → `relationship-copilot` → Settings → Variables and Secrets, type **Secret**, or from `web/`:
   ```bash
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name relationship-copilot
   npx wrangler secret put STRIPE_SECRET_KEY        --name relationship-copilot
   npx wrangler secret put STRIPE_WEBHOOK_SECRET    --name relationship-copilot
   npx wrangler secret put XAI_API_KEY              --name relationship-copilot
   npx wrangler secret put GA4_API_SECRET           --name relationship-copilot
   ```
   Optional: `RESEND_API_KEY` (notification emails) and `XAI_NO_TRAINING_DPA` (AI stays off until it is set, as on Vercel). **Don't cut over before the first four are set:** invites and audit logs need the service-role key, and billing needs both Stripe values.
2. **Patrick, GitHub.** Merge this PR. Add repo secrets `CLOUDFLARE_API_TOKEN` ("Edit Cloudflare Workers" template plus Zone → DNS → Edit for this zone) and `CLOUDFLARE_ACCOUNT_ID`, then set the repo variable `CLOUDFLARE_DEPLOY=true`. From then on every push to `main` deploys the Worker. Vercel keeps deploying in parallel until step 6.
3. **Patrick, cutover.** In the Cloudflare dashboard for the zone. The bare domain is the main host, so it moves first:
   - DNS → delete the bare-domain records that point at Vercel (today `A 216.150.16.193` and `A 216.150.1.193`). Leave the MX and TXT records alone. Then Workers → `relationship-copilot` → Settings → Domains & Routes → Add → Custom domain → `relationshipcopilot.com`. (Adding the domain while the old record exists fails with error 100117.)
   - DNS → delete the `www` CNAME (`dbcc9a4ca41351c1.vercel-dns-016.com`), then add the custom domain `www.relationshipcopilot.com`. The app 308s it to the bare domain.
   - SSL/TLS → Edge Certificates → turn on **Always Use HTTPS**.
   - Or give the agent's token Zone → DNS → Edit and say go; the agent does this step.
4. **Agent, verify on the real domain:**
   - `/api/health` shows the deployed commit; pages, `www` → bare 308, headers and HSTS.
   - Google and magic-link sign-in (Turnstile only allows the real host).
   - Stripe → Webhooks → send a test event; expect 200.
   - `/opengraph-image` twice; the second response is a cache HIT (`cf-cache-status` or `age`).
   - Workers → Logs: a `cron_tick` line at :20 past the hour with status 200.
5. **Agent PR:**
   - Add `routes` with `custom_domain: true` for both hosts to `wrangler.jsonc`, so a deploy can't drift from the dashboard.
   - Drop the deploy gate and the Vercel-specific comments.
6. **Patrick:** pause Vercel and disconnect Git. Delete the project after 30 days.

## 6. Rollback

Remove the Worker custom domains, recreate the §4 records (DNS-only), and unpause Vercel. The TTL is short.
