# Go-live checklist

Status audited 2026-07-31 against the real infrastructure (Supabase project
`digbnrhwsifmycrxyquo`, production at https://relationshipcopilot.com);
code status refreshed 2026-10-18 after the Cloudflare cutover and the
market / site / stack reviews (see `docs/ROADMAP.md` §5 for the ordered
list of what remains). Update the checkboxes as items land.

## Already done (verified)

- [x] **Code** — MVP complete on `main`; CI runs typecheck, 182 vitest tests (this branch),
      build, and the SQL/RLS reveal-gate tests. Local run: all green.
- [x] **Database** — migrations 0001–0012 applied to the `relationship-copilot`
      Supabase project (us-east-1, ACTIVE_HEALTHY); pg_cron enabled;
      `assign-daily-prompts` scheduled daily 08:05 UTC; seed content loaded;
      RLS enabled on every table.
- [x] **Migrations 0020–0032 applied to production** (verified 2026-10-17
      against `supabase_migrations.schema_migrations` and the live tables).
- [x] **Migrations 0033–0037 applied to production** (2026-10-17, via the
      Supabase MCP, each just before its PR merged): answer-first lookup and
      funnel step (0033), `push_subscriptions` (0034), `invite_notes` (0035),
      the `turn_reminder` notification kind (0036) and
      `blueprint_intake_consent` (0037). 0034 went in as three statements
      (table, trim helper, RPCs) and was recorded once in
      `schema_migrations`; the repo file is the same SQL.
- [x] **Migrations 0012–0015 applied to production** (2026-09-27, via the
      Supabase MCP). 0012 (`others_have_answered`) had never been applied, so
      the "they've answered, your turn" state was silently falling back to the
      empty state. 0013 ships the sibling + mentor "first 20" packs and a
      generic fallback, widens the daily pool to 6–13 questions per type,
      makes `accept_invite` refuse archived connections, and scopes
      `has_premium` to the caller. 0014 (PR 39) moves creator membership into
      a DB trigger, adds the `partner_profiles` view and zodiac RPC the
      deployed app already calls, and gives invites a 14-day expiry — it was
      merged without being applied, so production was briefly running app
      code against a schema without it. 0015 adds `regenerate_invite` so an
      expired link can be replaced from the connection page ("Get a new
      link"). Do not re-run 0013 (it inserts content).
- [x] **Product decision — 14-day invite expiry.** Decided 2026-10-18:
      keep 14 days. Members can mint a new link from the hub when one
      expires.
      Security advisors show only intentional items (SECURITY DEFINER RPCs
      whose grants migration 0009 already tightened; `stripe_events` is
      deny-all by design).
- [x] **Hosting** — production is the Cloudflare Worker
      `relationship-copilot` since 2026-10-18 (`docs/CLOUDFLARE_MIGRATION.md`):
      custom domains `relationshipcopilot.com` + `www` (Worker-level 308 to
      apex, query string kept), region placement `aws:us-east-1`, Cron
      Triggers at :20 and :40, ten secrets set, deploys from `main` by CI
      after unit, SQL and e2e tests. `/`, `/pricing`, `/login`, `/safety`,
      `robots.txt`, `sitemap.xml` return 200 on the live host. Vercel is
      still provisioned as the rollback until it is retired (§5).

## Blocking launch

### 1. Stripe (provisioned and connected; activation + test remain)

Provisioned 2026-08-10 in the **Relationship** account
(`acct_1TzIPbDmJBrl3Tmr`), live mode:

- [x] Product **Relationship Copilot Premium** (`prod_V2zqvmZXWKoURt`) with
      recurring price **$18/month USD**:
      `price_1U2tqaDmJBrl3Tmr3ILmUFy4` (lookup key `premium_monthly`).
- [x] Webhook endpoint `we_1U2tqeDmJBrl3Tmrtsq5TP9M` →
      `https://relationshipcopilot.com/api/stripe/webhook`, subscribed to
      exactly: `checkout.session.completed`,
      `customer.subscription.updated`, `customer.subscription.deleted`
      (all the handler consumes — see `web/app/api/stripe/webhook/route.ts`).
- [x] Vercel Production env vars set (`STRIPE_SECRET_KEY`,
      `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PRICE_PREMIUM`) and
      redeployed 2026-08-10 — billing is connected.
- [ ] Confirm the account is fully **activated** for live charges (Stripe
      Dashboard shows a banner if business/bank details are incomplete).
- [ ] **Customer portal configuration** (Stripe Dashboard → Settings →
      Billing → Customer portal, live mode): save a configuration with
      "cancel subscription" and "update payment method" enabled. `/account`
      now has a **Manage billing** button (`createBillingPortal`) that opens
      the portal; without a saved default configuration Stripe rejects the
      session and the page shows a "couldn't open billing" notice. This is
      how the Terms' "cancel anytime" promise is actually kept — before this
      there was no cancellation path in the product at all. Note: the Stripe
      MCP connector in Claude is linked to a different account (Lil Learning),
      so this has to be done in the Dashboard for the Relationship account.
- [ ] Test checkout with a live card, confirm the `subscriptions` row flips
      and `/account` shows Premium; open Manage billing → cancel → confirm
      the row downgrades at period end (`customer.subscription.updated` →
      `deleted`).

### 2. Supabase Auth configuration (dashboard)

Configured 2026-08-10 (verified: Google `/authorize` redirects; the OTP
endpoint enforces captcha):

- [x] **Custom SMTP** via Resend (`smtp.resend.com`, sender
      `noreply@relationshipcopilot.com`), with DKIM/SPF DNS in Cloudflare.
- [x] **Google OAuth** enabled (new Google Cloud project + web client;
      redirect URL allow-listed).
- [x] `NEXT_PUBLIC_AUTH_PROVIDERS=google` set in Vercel — only the Google
      button renders on production.
- [x] **CAPTCHA (frontend)**: login form renders Cloudflare Turnstile and
      submits `captchaToken` with `signInWithOtp`
      (`web/components/Turnstile.tsx`; production site key is the built-in
      default in `web/lib/turnstile.ts`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY=off`
      for local dev). The Aug 10 site-key typo (extra `A` → Cloudflare
      `invalidsitekey` / errCode 400020) is fixed in-repo; magic-link still
      needs the dashboard secret + an E2E pass below.
- [ ] **CAPTCHA (Supabase secret)**: in Supabase → Authentication → Attack
      Protection, paste the **secret key** from the Cloudflare Turnstile
      widget named `relationship-copilot` (not a typo / leftover secret).
      A wrong secret returns `invalid-input-secret` even after the widget
      renders.
- [ ] After deploy + secret paste: on https://relationshipcopilot.com/login
      confirm the Turnstile widget renders (no Troubleshoot), the
      "Email me a secure link" button enables after the check, a real
      magic link arrives via Resend, and clicking it signs in.
- [ ] **Email invites — the one required line** (Authentication → URL
      Configuration): add `https://relationshipcopilot.com/invite/*` to
      Redirect URLs so the invite email can land on the invite page. The
      invite page consumes the implicit-flow tokens client-side
      (`AuthFragmentSession`), so with just this line the default email
      template already signs the invitee in and auto-joins them.
- [ ] Optional hardening (Authentication → Emails → Invite user template):
      point the link at the token-hash callback for a server-side sign-in
      instead of the fragment handoff:
      `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next={{ .RedirectTo }}`
- [ ] Optional cleanup: delete the three bot users; delete the old INACTIVE
      `relationshipcopilot` Supabase project from 2025 to avoid confusion.

### 3. AI provider (xAI)

`web/lib/grok.ts` refuses all AI calls in production unless
`XAI_NO_TRAINING_DPA=true`, which should only be set once a no-training DPA
is actually in place. Until then the app works but Blueprint/digest
generation errors, and the safety classifier runs regex-only (its model
escalation uses the same client; the regex fast path still gates).

- [x] `XAI_API_KEY` present in Vercel (since Jun 11).
- [x] **Decision (2026-10-18): stay on xAI.** xAI's Enterprise Terms of
      Service §3.1 commit to no training on our content, and the DPA is
      incorporated into those terms. Patrick confirmed no data-sharing
      program is enabled in console.x.ai and has asked xAI for written
      confirmation and zero data retention (ZDR).
- [ ] Set `XAI_NO_TRAINING_DPA=true` on the Worker (Patrick):
      `npx wrangler secret put XAI_NO_TRAINING_DPA --name relationship-copilot`.
- [ ] File xAI's written confirmation and the ZDR answer when they arrive.
- [x] Default model is `grok-latest` (`DEFAULT_GROK_MODEL` in
      `web/lib/grok.ts`); `XAI_MODEL` still overrides it.

### 4. Notification emails (optional, code shipped 2026-10-13)

Roadmap item 3 (`docs/ROADMAP.md`). Nothing sends until these are set; the
product behaves exactly as before without them.

- [ ] Create a Resend **API key** (the domain already signs for Resend via
      Supabase SMTP) and set `RESEND_API_KEY` in the hosting env. Optional
      `EMAIL_FROM` (defaults to `Relationship Copilot
      <noreply@relationshipcopilot.com>`). From then on "they joined",
      "they answered, your turn", "you both answered" and "they wrote in a
      discussion" emails go out after a join, submit or first reply, subject
      to each person's Account → Notifications settings.
- [ ] **"Still your turn" follow-up.** Migration 0036 is applied. The Worker Cron Trigger
      `40 * * * *` calls `/api/cron/turn-reminder` with the same
      `CRON_SECRET`; it does nothing until email or push is configured.
- [ ] **Web push (no account needed).** Migration 0034 is applied. From
      `web/` run
      `node scripts/vapid-keys.mjs --wrangler` once. It generates the pair
      and stores `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` as Worker secrets
      without printing the private key. Until the cutover, also add both to
      Vercel (Sensitive); `--print-private` shows the private key once.
      Optional `VAPID_SUBJECT` (defaults to
      `mailto:privacy@relationshipcopilot.com`). Then Account → "Turn on
      notifications" on your own phone and answer something from a second
      account to see one arrive. Generate the pair once: a new pair retires
      every existing browser subscription.
- [ ] Daily reminder email. On Cloudflare this is a Worker Cron Trigger
      (`20 * * * *` in `web/wrangler.jsonc`), which calls
      `/api/cron/daily-reminder` with the Worker's `CRON_SECRET` (already set
      on the Worker). No pg_cron job, `pg_net` or SQL secret is needed. Check
      Workers → Logs for a `cron_tick` line at :20 past the hour after the
      cutover. Do not also schedule it in pg_cron, or the route is hit twice
      an hour (harmless, since it is idempotent, but wasteful).

      The route is idempotent (one email per person per connection per local
      day, enforced by `notification_log`), zone-aware (migration 0025 gives
      each connection a time zone; 9am–8pm local only) and only emails
      people who opted in to "Today's question is ready". It does nothing
      until `RESEND_API_KEY` is set.
- [ ] `NOTIFY_SECRET` for signing unsubscribe links is set on the Worker
      (it falls back to a server-only key if missing). One-click unsubscribe is at
      `/api/notifications/unsubscribe` and also set as the
      `List-Unsubscribe` header.
- [ ] **Price (decided 2026-10-18): $9.99/month and $59.99/year, one plan
      covers both people.** Patrick creates both prices on the Premium
      product in Stripe and sends the two price IDs; one PR then updates
      `PREMIUM_MONTHLY_USD` (`web/lib/pricing.ts`) and the public price IDs
      and annual display string in `web/.env.production`. Existing
      subscribers keep the price they signed up at. The webhook needs no
      change.

### 5. Cloudflare and database hardening (from the 2026-10-18 reviews)

- [x] **Migrations 0038–0040 applied to production** (2026-10-18, via the
      Supabase MCP, recorded in `schema_migrations`): 0038 (25 policies
      rewritten to `(select auth.uid())`, 12 FK indexes, 3 hot-path
      indexes), 0039 (one article title), 0040 (daily reminder selection in
      SQL, 12-char invite codes). #121–#123 are merged and deployed; #124
      can merge any time since 0040 is already in.
- [ ] **Merge #124, #126 and #127.** #127 matters first: three merges in a
      row on 2026-10-18 cancelled the deploy of the newest commit (GitHub
      cancels the older *pending* job in a concurrency group), so nothing
      shipped until the job was re-run by hand. Until it is merged, after
      merging several PRs quickly, check `/api/health` shows the tip of
      `main` and re-run the cancelled deploy job if not.
- [ ] **Rate limiting on the public invite and login routes.** Cloudflare
      dashboard → the zone → Security → WAF → Rate limiting rules → Create:
      expression `(http.request.uri.path matches "^/invite/") or
      (http.request.uri.path eq "/login")`, characteristics IP, 30 requests
      per 10 seconds, action Block for 10 seconds. Invite codes are now 12
      characters (60 bits), so this is belt and braces against enumeration,
      and it also throttles magic-link spam.
- [ ] **Schema drift: `public.mission_control_counts`.** Production has
      this function (anon-executable, `SECURITY DEFINER`, passcode-gated
      aggregate counts) and the repository does not. Either commit it as
      migration 0041 (with the passcode moved to a Worker secret and the
      function restricted to `service_role`) or drop it. Decide before the
      next migration so `supabase/tests/run.sh` keeps matching production.
- [ ] **Retire the pg_cron `assign-daily-prompts` job** one week after
      #124 deploys, once Workers Logs show `cron_tick` for
      `/api/cron/daily-reminder` with `created` > 0 on a day a pair was
      active. Supabase → Integrations → Cron → unschedule. Harmless while
      both run; `ensure_daily_prompt` is idempotent.
- [ ] **Retire Vercel.** Project settings → Integrations → remove the
      Supabase integration first (so it stops syncing env vars), then delete
      the project. Keep the DNS as it is (Cloudflare proxied to the Worker).
- [ ] **Delete the stale remote branches** the merge pass left (their PRs
      are merged): `claude/cloudflare-cutover`, `claude/decisions-oct18`,
      `claude/digest-on-visit`, `claude/post-cutover`,
      `claude/post-cutover-fixes`, `claude/relationship-copilot-review-y373ct`,
      `claude/relationship-program-review-3ixZU`, `claude/sentry-worker`,
      `cursor/stripe-api-version-fbe0`, plus any `cursor/*` or `dependabot/*`
      branch whose PR is closed. `git push origin --delete <branch>` for
      each; branch deletion is blocked from the cloud session.

## Error alerting (Sentry, decided 2026-10-18)

Code shipped: `@sentry/cloudflare` wraps the Worker (`web/worker/index.ts`).
Unhandled errors in route handlers, server actions, rendering and the proxy
arrive through Next's `onRequestError` (`web/instrumentation.ts`), and each
Cron Trigger is a Sentry cron monitor (`daily-reminder`, `turn-reminder`)
whose check-in fails on a thrown error or a non-2xx route response. Workers
Logs stay on.

Privacy: no relationship text and no personal data reach Sentry. Request
data, cookies, headers, bodies, query strings, user info, breadcrumbs and
tracing are all off, and every event passes an allowlist scrubber
(`web/lib/sentryScrub.ts`, unit-tested) that keeps only the exception type,
a sanitised first line of the message, stack frames, the route pattern
(`/invite/[code]`, never the real path) and the release.

- [ ] Create a Sentry project (platform: Cloudflare Workers), copy its DSN,
      then from `web/`: `npx wrangler secret put SENTRY_DSN --name relationship-copilot`.
      Nothing is sent until it is set.
- [ ] Alerts → Create alert → Issues → "A new issue is created" → send an
      email to you. (New projects usually come with this rule; check it is
      on and pointed at your address.)
- [ ] Crons: after the first hourly run each monitor appears under
      Insights → Crons. Open each one → set its alert to email you. A
      monitor raises an issue on the first failed or missed check-in
      (`failureIssueThreshold: 1`), which the new-issue rule also emails.
- [ ] Settings → Security & Privacy: turn on "Prevent storing of IP
      addresses" and leave "Data scrubber" on, as a second layer.

## Non-code sign-offs (from NEW_ARCHITECTURE.md)

- [ ] Legal review of `/privacy` and `/terms` (both still drafts).
- [ ] Safety-resource review (`/safety` numbers/links current per region).
- [ ] COPPA / GDPR-K verifiable-consent flow before allowing under-13 use
      in the parent–teen track.

## Final smoke test (after the above)

- [ ] Two fresh accounts → create connection → invite link → accept.
- [ ] Repeat once with a **sibling** or **mentor** connection to confirm the
      new 0013 onboarding pack loads (this was the broken path).
- [ ] 20-question onboarding both sides → mutual reveal fires live
      (Realtime) → discussion thread.
- [ ] Daily prompt appears; the Worker cron creates and reminds inside the
      connection's 9am–8pm local window (`cron_tick` at :20 in Workers Logs).
- [ ] Premium checkout → Blueprint generates → weekly digest.
- [ ] Data export downloads; account deletion redacts while the partner
      keeps their content.
