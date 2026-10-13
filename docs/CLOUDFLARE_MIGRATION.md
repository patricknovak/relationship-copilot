# Moving relationshipcopilot.com from Vercel to Cloudflare Workers

Status (2026-10-11): **Phases 0–4 are on a branch:**
- Next 16 upgrade.
- vinext Workers build, verified locally in workerd.
- CI build and a gated deploy job.

Nothing is deployed. Next is Patrick's go for a `workers.dev` test deploy (§5, step 1).

Worker: `relationship-copilot` · Path: **vinext** (`vinext check`: 98% compatible, 0 issues) · Playbook: `docs/CLOUDFLARE_MIGRATION_PLAYBOOK.md`.

## 1. Inventory (Phase 0)

| Item | Finding |
|---|---|
| Vercel project | `relationship-copilot` (`prj_OKbm6q58LX5tNXOg5AKvP5tLH1PW`). Production branch `main`. Node 24. Builds `web/`. |
| App | Next.js 15.5 → **16.4** in this branch. React 19.3, App Router. 19 pages, 4 route handlers, plus OG images, sitemap, robots and manifest. Supabase SSR auth. Stripe. xAI. GA4 Measurement Protocol via `after()`. |
| `vercel.json` / crons | None. No scheduled jobs. |
| Proxy | `middleware.ts` → `proxy.ts`: Supabase session refresh, then the CSP (report-only) and security headers. |
| Edge runtime | The two OG images declared `runtime = "edge"`. Removed; they render on the Node runtime, and both return 200 on the Worker. |
| Stripe webhook | Already `constructEventAsync`. Verified in workerd: a bad signature returns 400 and a valid one returns 200. |
| Turnstile | The login widget's hostname list is `relationshipcopilot.com` only. **Magic-link sign-in can't be tested on `workers.dev`**; test it on the real domain after the cutover. The site key is built in, and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is an optional override. |
| Env read by code | **Server**: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `XAI_API_KEY`, `XAI_MODEL`, `XAI_BASE_URL`, `XAI_NO_TRAINING_DPA`, `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`, and (optional, notifications) `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `NOTIFY_SECRET`. **Build-time**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_STRIPE_PRICE_PREMIUM`, `NEXT_PUBLIC_AUTH_PROVIDERS`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_GTM_ID`. The Vercel Supabase integration also injects `POSTGRES_*`, `SUPABASE_*` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, which the app doesn't read; the env script skips them. |
| Domains | `relationshipcopilot.com` is canonical (the bare domain). `www` 308s to it, both in Vercel Domains and in `next.config.mjs` `redirects()`. |
| DNS (zone `0dddda8d6ff408af498a086d8749a1cc`, already on Cloudflare) | See §4. Email routing MX on the bare domain; `www` has an MX to `mx.relationshipcopilot.com`. Leave both alone. |
| HSTS | Vercel sends `strict-transport-security: max-age=63072000` (2 years). `next.config.mjs` deliberately doesn't set it. **At cutover, turn on HSTS in the zone with max-age 2 years**, or the site loses it. |
| CI | `.github/workflows/web-ci.yml`: typecheck, test, build, plus a Postgres job for migrations and RLS. This branch adds lint, the Cloudflare build and the gated `deploy-cloudflare` job. |

## 2. Decisions and changes in this branch

- **Next 16:**
  - `middleware.ts` → `proxy.ts`.
  - `next lint` → ESLint flat config (`eslint.config.mjs`). React Compiler rules are off, including the new `react-hooks/refs`, which flagged the Turnstile widget's ref pattern. Behaviour is unchanged.
  - `runtime = "edge"` removed from the OG images.
- **The `postcss` override `$postcss` is pinned to `^8.5.28`** (same range). npm refused to add packages with the `$` reference.
- **vinext build:**
  - `vite.config.ts` with the prerender cache. Only `/opengraph-image` prerenders today, because pages read cookies.
  - `wrangler.jsonc`.
  - `worker/index.ts`: vinext's handler only, since the app has no crons.
  - `"type": "module"`.
  - Scripts `build:vinext`, `start:vinext` and `deploy:vinext`.
  - `next build` still works, so Vercel stays the fallback.
- **Local gotcha:** run `rm -rf .next` between `npm run build` and `npm run build:vinext` before `npm run typecheck`. vinext rewrites `.next/types/routes.d.ts`, which clashes with `next build`'s validator. CI typechecks a fresh tree first, so it isn't affected.
- **CI:** Lint plus the Cloudflare build on every PR. `deploy-cloudflare` runs on push to `main` only when `vars.CLOUDFLARE_DEPLOY == 'true'`, and fails fast without the Cloudflare secrets.
- **`web/scripts/cloudflare-env.mjs`:** copies Vercel's production env to Worker secrets and GitHub variables without printing values (playbook §8).

## 3. URL parity (live Vercel vs. the Worker under `wrangler dev`)

| Path | Vercel | Worker |
|---|---|---|
| `/`, `/about`, `/pricing`, `/privacy`, `/terms`, `/safety`, `/library`, `/login` | 200 | 200 |
| `/account`, `/connections`, `/onboarding` | 307 → `/login?next=…` | same |
| `/auth/confirm` (no token) | 307 → `/login?error=auth` | same |
| `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/icon.svg`, `/opengraph-image` | 200 | 200 |
| `/nope` | 404 | 404 |
| `www.` host | 308 → bare domain | 308 → bare domain (`next.config` redirect) |
| `POST /api/stripe/webhook`, unsigned | 400 | 400 with the secret set (500 means `STRIPE_WEBHOOK_SECRET` is missing) |

## 4. DNS before the switch (rollback)

Read from public DNS on 2026-10-11. All records are DNS-only.

| Host | Record |
|---|---|
| `relationshipcopilot.com` | `A 216.150.16.129`, `A 216.150.1.129` (Vercel; possibly a flattened CNAME, so check the dashboard) |
| `www.relationshipcopilot.com` | `CNAME dbcc9a4ca41351c1.vercel-dns-016.com` |

## 5. Steps (gates marked **Patrick**)

1. **Patrick:**
   - Go for a test deploy to `relationship-copilot.patricknovak1.workers.dev`.
   - Run the env script: `npx vercel env pull`, then `node scripts/cloudflare-env.mjs .env.cloudflare --dry-run`, then run it for real with `--github`, then set the `[SENSITIVE]` values by hand with `npx wrangler secret put NAME --name relationship-copilot`.
2. **Agent:** deploy to `workers.dev` and re-run §3 there. Sign-in is checked after the cutover because of Turnstile.
3. **Patrick:**
   - Merge this PR. Vercel deploys Next 16 first, which is the real-world check of the upgrade.
   - Add GitHub secrets `CLOUDFLARE_API_TOKEN` ("Edit Cloudflare Workers" template plus Zone → DNS → Edit for this zone) and `CLOUDFLARE_ACCOUNT_ID`.
   - Set the variable `CLOUDFLARE_DEPLOY=true`.
4. **Patrick, cutover.** The bare domain is the main host, so it moves first:
   - In DNS, delete the bare-domain record(s) pointing at Vercel.
   - Add the custom domain `relationshipcopilot.com` to the Worker `relationship-copilot`.
   - Then delete the `www` CNAME and add `www.relationshipcopilot.com` as a custom domain. The app redirects it to the bare domain.
   - In the zone: turn on **Always Use HTTPS**, and turn on **HSTS** (max-age 2 years, include subdomains only if every subdomain is HTTPS).
5. **Agent:** check pages, sign-in (magic link plus Turnstile), the Stripe webhook (send a test event from the Stripe dashboard), redirects and headers on the real domain.
6. **Agent PR:**
   - Add `routes` for both hosts to `wrangler.jsonc`.
   - Drop the deploy gate.
   - Remove the Vercel-specific comments.
7. **Patrick:** pause Vercel and disconnect Git. Delete the project after 30 days.

## 6. Rollback

Remove the Worker custom domains, recreate the §4 records (DNS-only), and unpause Vercel. The TTL is short.
