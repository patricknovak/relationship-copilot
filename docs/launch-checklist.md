# Go-live checklist

Status audited 2026-07-31 against the real infrastructure (Supabase project
`digbnrhwsifmycrxyquo`, Vercel project `relationship-copilot`, production at
https://relationshipcopilot.com). Update the checkboxes as items land.

## Already done (verified)

- [x] **Code** — MVP complete on `main`; CI runs typecheck, 54 vitest tests,
      build, and the SQL/RLS reveal-gate tests. Local run: all green.
- [x] **Database** — all 9 migrations applied to the `relationship-copilot`
      Supabase project (us-east-1, ACTIVE_HEALTHY); pg_cron enabled;
      `assign-daily-prompts` scheduled daily 08:05 UTC; seed content loaded
      (35 prompt templates, 9 library articles); RLS enabled on every table.
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
- [ ] Test checkout with a live card, confirm the `subscriptions` row flips
      and `/account` shows Premium; then cancel and confirm it downgrades.

### 2. Supabase Auth configuration (dashboard)

Configured 2026-08-10 (verified: Google `/authorize` redirects; the OTP
endpoint enforces captcha):

- [x] **Custom SMTP** via Resend (`smtp.resend.com`, sender
      `noreply@relationshipcopilot.com`), with DKIM/SPF DNS in Cloudflare.
- [x] **Google OAuth** enabled (new Google Cloud project + web client;
      redirect URL allow-listed).
- [x] `NEXT_PUBLIC_AUTH_PROVIDERS=google` set in Vercel — only the Google
      button renders on production.
- [x] **CAPTCHA**: Turnstile widget for `relationshipcopilot.com` enabled in
      Supabase Attack Protection, and the login form now submits the
      Turnstile token with magic-link requests
      (`web/components/Turnstile.tsx`; the production site key is the
      built-in default, `NEXT_PUBLIC_TURNSTILE_SITE_KEY=off` for local dev).
- [ ] After this change deploys, send a real magic link end-to-end to
      confirm Resend delivery and the captcha flow.
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

## Non-code sign-offs (from NEW_ARCHITECTURE.md)

- [ ] Legal review of `/privacy` and `/terms` (both still drafts).
- [ ] Safety-resource review (`/safety` numbers/links current per region).
- [ ] COPPA / GDPR-K verifiable-consent flow before allowing under-13 use
      in the parent–teen track.

## Final smoke test (after the above)

- [ ] Two fresh accounts → create connection → invite link → accept.
- [ ] 20-question onboarding both sides → mutual reveal fires live
      (Realtime) → discussion thread.
- [ ] Daily prompt appears; cron fires 08:05 UTC next day.
- [ ] Premium checkout → Blueprint generates → weekly digest.
- [ ] Data export downloads; account deletion redacts while the partner
      keeps their content.
