# Operations runbook

How production runs, how to check it, and what to do when something breaks.
Written 2026-10-28. Keep it short and true; update it when the setup changes.

## 1. What runs where

| Piece | Where | Notes |
| --- | --- | --- |
| Web app, server actions, API routes | Cloudflare Worker `relationship-copilot` | relationshipcopilot.com (apex); `www` 308s to apex. Placed in `aws:us-east-1`, next to the database. |
| Hourly jobs | Worker Cron Triggers | `:20` → `/api/cron/daily-reminder` (creates today's question for joined pairs, then optional reminders). `:40` → `/api/cron/turn-reminder`. Both idempotent. |
| Database, auth, realtime | Supabase project `digbnrhwsifmycrxyquo` (us-east-1, Pro plan) | RLS is the security boundary. pg_cron still runs `assign-daily-prompts` at `:05` until it is retired (harmless duplicate). |
| Payments | Stripe, account "Relationship" | Webhook → `/api/stripe/webhook` (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`). |
| Email | Resend | Auth mail via Supabase custom SMTP; notification mail via the Resend API from the Worker. |
| AI | xAI (Grok) | Server-side only, redacted first, safety-screened. Refused in production unless `XAI_NO_TRAINING_DPA=true`. |
| Errors | Sentry (Worker) | Scrubbed by an allowlist (`web/lib/sentryScrub.ts`): no user text, no personal data. Cron monitors for both jobs. |
| Analytics | GTM → GA4 | Public pages only, after cookie consent. Never inside the signed-in app. |

## 2. Secrets and what breaks without each

Worker secrets are set with `npx wrangler secret put NAME --name relationship-copilot` from `web/`. Deploys never touch them. Public build-time values live in `web/.env.production`.

| Secret | Without it |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Invites, crons, webhooks, AI insights, export and deletion fail. Required. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Checkout, billing portal and the webhook fail. Required for Premium. |
| `XAI_API_KEY`, `XAI_NO_TRAINING_DPA=true` | AI is off. The product then says so honestly: pricing shows "Opening soon" and checkout refuses, the Blueprint and digest say "switching on soon", the safety screen runs regex-only. |
| `RESEND_API_KEY` **and** `NOTIFY_SECRET` | No notification email. Both are needed: there is no fallback for `NOTIFY_SECRET` (it signs unsubscribe links). Account → Notifications says which channels are live. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | No web push; the Account toggle is hidden. Generate once with `node scripts/vapid-keys.mjs --wrangler`. A new pair retires every existing subscription. |
| `CRON_SECRET` | Cron routes return 401; today's question is still created on visit, but no reminders and no pre-creation. |
| `SENTRY_DSN` | No error alerts. Workers Logs still record errors. |
| `GA4_API_SECRET` | Server-side GA4 events are skipped (they are currently disabled pending consent gating anyway). |

## 3. Verify a deploy

1. GitHub → Actions → the CI run for the merge commit: `web`, `database`, `e2e-core` green, then `deploy-cloudflare`.
2. `curl -s https://relationshipcopilot.com/api/health` returns `{"ok":true,"commit":"<sha>"}`. The sha must be the tip of `main`. If it is older, a deploy was skipped or failed: re-run the `deploy-cloudflare` job on the tip commit.
3. Spot-check `/`, `/pricing`, `/login`, `/safety` return 200.

## 4. Roll back

- **Code:** from `web/`, `npx wrangler deployments list --name relationship-copilot`, then `npx wrangler rollback <deployment-id> --name relationship-copilot`. Then revert the bad commit on `main` so the next deploy doesn't bring it back.
- **Hosting (emergency only):** `docs/CLOUDFLARE_MIGRATION.md` §6 describes moving traffic back to Vercel while it still exists.
- **Database:** migrations are forward-only. Write a new migration that undoes the change; never edit an applied file.

## 5. Database migrations

- Files in `supabase/migrations/` apply in filename order. CI replays every one against Postgres 16 and runs the SQL tests in `supabase/tests/`.
- Production gets a migration only with Patrick's explicit go (PR template). Apply it in the Supabase SQL editor (or the MCP `apply_migration`), then confirm it appears in `supabase_migrations.schema_migrations` and re-run the security advisors.
- Apply **before** merging code that needs it. App code is written to degrade when a new table or function is missing, but a migration that lands late still means a feature is dark.
- Content migrations (seeds, library) are idempotent; re-running them is a no-op.

## 6. Backups and restore

- The Supabase organization is on the **Pro** plan, which includes **daily backups**, retained for 7 days. Check Supabase → Database → Backups to see them.
- **Point-in-time recovery** is a paid add-on. Check the same page for whether it is on. Turn it on once real people are using the product: a daily backup can lose up to a day of answers.
- Restoring a backup replaces the project's database and takes it offline while it runs. Before restoring, pause the Worker crons (comment out `triggers` and deploy) so nothing writes mid-restore, then restore, then redeploy.
- The schema itself is always recoverable from `supabase/migrations/`; content seeds are in the same files.
- **Drill once before launch:** in Supabase, restore the latest daily backup into a new, throwaway project (if the dashboard offers it on this plan), confirm row counts in `profiles`, `connections` and `prompt_responses`, then delete that project.
- Do not keep ad-hoc data dumps on laptops. They contain private answers.

## 7. Daily checks (two minutes)

- Sentry: any new issue, or a failed cron monitor (`daily-reminder`, `turn-reminder`).
- Workers Logs: a `cron_tick` line at `:20` and `:40` each hour; `cron_tick_failed` means the route returned non-2xx.
- Stripe → Developers → Webhooks: no failing deliveries.
- `docs/metrics.sql` for the funnel and habit numbers (no answer text is read).

## 8. When something breaks

| Symptom | Check | Fix |
| --- | --- | --- |
| Nobody can sign in by email | Supabase → Auth logs; Turnstile errors | Paste the Turnstile **secret** in Supabase → Authentication → Attack Protection; confirm the Resend SMTP domain is verified. Google sign-in is unaffected. |
| Emailed invites land on the home page | Supabase → Authentication → URL Configuration | Add `https://relationshipcopilot.com/invite/*` to Redirect URLs. |
| "Couldn't open billing" on Account | Stripe Customer Portal config | Save a live-mode portal configuration with cancel and update-payment enabled. |
| Paid but not Premium | Stripe webhook deliveries; `subscriptions` row | Re-send the event from Stripe; the handler is idempotent. |
| Blueprint "couldn't finish" | Sentry; xAI status | Provider outage or bad model id (`XAI_MODEL`). Nothing is lost; the free Blueprint is given back on failure. |
| No notification email | Resend dashboard; Account → Notifications channel note | `RESEND_API_KEY` and `NOTIFY_SECRET` both set? Domain verified? |
| No daily question | Workers Logs for `/api/cron/daily-reminder` | Today's question is also created when either person opens the connection. |
| Safety | `safety_events` (metadata only) | Review new rows weekly. Never contact a user about one, and never tell the other person. |

## 9. Smoke test (before launch and after risky deploys)

Two real accounts on the production domain:

1. A: sign in with Google, name only, create a **friend** connection, answer the first question set, share the link.
2. B: open the invite (and once via the emailed invite), sign in, name in place on the questions page, join.
3. Both: today's question appears straight away; both answer it; the reveal arrives live.
4. Both: finish the first set; reveal; react; reply in the discussion.
5. Either: generate the free Blueprint; confirm the second attempt asks for Premium.
6. A: Premium checkout with a live card; Blueprint regenerate works; Manage billing → cancel; Premium ends at period end.
7. A: data export downloads; delete A; B keeps their own answers and sees the connection archived.
