# Go-live checklist

Status audited 2026-07-31 against the real infrastructure (Supabase project
`digbnrhwsifmycrxyquo`, Vercel project `relationship-copilot`, production at
https://relationshipcopilot.com). Update the checkboxes as items land.

## Already done (verified)

- [x] **Code** — MVP complete on `main`; CI runs typecheck, 54 vitest tests,
      build, and the SQL/RLS reveal-gate tests. Local run: all green.
- [x] **Database** — migrations 0001–0012 applied to the `relationship-copilot`
      Supabase project (us-east-1, ACTIVE_HEALTHY); pg_cron enabled;
      `assign-daily-prompts` scheduled daily 08:05 UTC; seed content loaded;
      RLS enabled on every table.
- [ ] **Migrations 0020–0027** (2026-10-13, this branch) are not yet applied;
      see §4 below. 0020 is idempotent (skips if batch already seeded).
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
- [ ] **Product decision — 14-day invite expiry** (introduced by 0014 with a
      "confirm with product owner" note). The stranding case is covered
      (members can mint a new link), so this is now just a question of
      whether 14 days is the right window.
      Security advisors show only intentional items (SECURITY DEFINER RPCs
      whose grants migration 0009 already tightened; `stripe_events` is
      deny-all by design).
- [x] **Hosting** — Vercel production is READY at the latest `main` commit,
      auto-deploying from GitHub. Domains `relationshipcopilot.com` + `www`
      attached; `NEXT_PUBLIC_SITE_URL` is set correctly (sitemap emits the
      real domain). `/`, `/pricing`, `/login`, `/safety`, `robots.txt`,
      `sitemap.xml` all return 200. No production runtime errors in the last
      7 days.

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
- [ ] Confirm `XAI_NO_TRAINING_DPA` in Vercel matches the real DPA status
      with xAI — only `true` once a no-training agreement is in place.

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
- [ ] Set `CRON_SECRET` (any long random string) and schedule the daily
      reminder. The DB already runs pg_cron; with `pg_net` enabled
      (Database → Extensions), run once in the SQL editor with the real
      secret (do not commit it):

      ```sql
      select cron.schedule(
        'daily-reminder-email',
        '20 * * * *',    -- hourly; the route emails each connection once, inside its own 9am–8pm local window
        $$ select net.http_post(
             url := 'https://relationshipcopilot.com/api/cron/daily-reminder',
             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb
           ); $$
      );
      ```

      The route is idempotent (one email per person per connection per local
      day, enforced by `notification_log`), zone-aware (migration 0025 gives
      each connection a time zone; 9am–8pm local only) and only emails
      people who opted in to "Today's question is ready". Vercel cron or a Cloudflare scheduled
      handler can call the same URL instead.
- [ ] Optional `NOTIFY_SECRET` for signing unsubscribe links (falls back to a
      server-only key). One-click unsubscribe is at
      `/api/notifications/unsubscribe` and also set as the
      `List-Unsubscribe` header.
- [ ] Apply migrations **0020** (daily pool, idempotent), **0021**
      (`notification_log` + love-languages wording), **0022**
      (`connection_has_premium`: one plan covers both people), **0023**
      (`answer_reactions`, adds the table to the Realtime publication) and
      **0024** (electives, idempotent), **0025** (connection time zones;
      also moves the `assign-daily-prompts` pg_cron job from daily to hourly)
      **0026** (`partner_joined`) and **0027** (`discussion_reply`
      notification kinds) to production.
      0022 changes behaviour the moment it is applied: a free partner of a
      subscriber can read and generate the Blueprint/digest for that
      connection, as the pricing page now says.
- [ ] **Annual plan (optional, roadmap item 8).** Create a yearly price in
      Stripe (recommendation in the roadmap: $59.99/yr with a $9.99/mo
      monthly), then set `NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_ANNUAL` and
      `NEXT_PUBLIC_PREMIUM_ANNUAL_DISPLAY` (e.g. `$59.99/yr`). The yearly
      button renders only when both are set; the webhook needs no change.

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
- [ ] Daily prompt appears; cron fires 08:05 UTC next day.
- [ ] Premium checkout → Blueprint generates → weekly digest.
- [ ] Data export downloads; account deletion redacts while the partner
      keeps their content.
