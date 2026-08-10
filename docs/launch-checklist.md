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

### 1. Stripe (objects created; env vars still needed)

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
- [ ] In Vercel → Project → Environment Variables (Production), set
      `STRIPE_SECRET_KEY` (Dashboard → Developers → API keys),
      `STRIPE_WEBHOOK_SECRET` (the endpoint's signing secret),
      `NEXT_PUBLIC_STRIPE_PRICE_PREMIUM=price_1U2tqaDmJBrl3Tmr3ILmUFy4`,
      then redeploy (the `NEXT_PUBLIC_*` value is inlined at build time).
- [ ] Confirm the account is fully **activated** for live charges (Stripe
      Dashboard shows a banner if business/bank details are incomplete).
- [ ] Test checkout with a live card, confirm the `subscriptions` row flips
      and `/account` shows Premium; then cancel and confirm it downgrades.

### 2. Supabase Auth configuration (dashboard)

Verified today: **no OAuth provider is enabled** — Google, Apple, and
Facebook all return "provider is not enabled", so only magic-link email
works, on Supabase's built-in rate-limited SMTP (a few emails/hour).

- [ ] Configure **custom SMTP** (e.g. Resend/Postmark/SES) — magic link is
      the primary auth path and the default sender cannot handle launch
      traffic. Set a matching sender domain + SPF/DKIM.
- [ ] Enable the OAuth providers you want at launch (Google at minimum);
      add `https://relationshipcopilot.com/auth/callback` as a redirect URL.
- [ ] Set `NEXT_PUBLIC_AUTH_PROVIDERS` in Vercel to the providers actually
      enabled (e.g. `google`), or `none` for email-only — unconfigured
      buttons are hidden instead of failing on click.
- [ ] Enable **CAPTCHA** on auth (Turnstile/hCaptcha): three bot signups
      already landed between Jul 11–22 (never signed in). Requires passing
      the captcha token in the client auth calls — small code change.
- [ ] Optional cleanup: delete the three bot users; delete the old INACTIVE
      `relationshipcopilot` Supabase project from 2025 to avoid confusion.

### 3. AI provider (xAI)

`web/lib/grok.ts` refuses all AI calls in production unless
`XAI_NO_TRAINING_DPA=true`, which should only be set once a no-training DPA
is actually in place. Until then the app works but Blueprint/digest
generation errors, and the safety classifier runs regex-only (its model
escalation uses the same client; the regex fast path still gates).

- [ ] Production `XAI_API_KEY` in Vercel.
- [ ] No-training DPA with xAI, then set `XAI_NO_TRAINING_DPA=true`.

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
