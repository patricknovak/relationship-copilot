# Operations runbook

How production runs, how to check it, and what to do when something breaks.
Written 2026-10-28. Keep it short and true; update it when the setup changes.

## 1. What runs where

| Piece | Where | Notes |
| --- | --- | --- |
| Web app, server actions, API routes | Cloudflare Worker `relationship-copilot` | relationshipcopilot.com (apex); `www` 308s to apex. Placed in `aws:us-east-1`, next to the database. |
| Hourly jobs | Worker Cron Triggers | `:20` → `/api/cron/daily-reminder` (creates today's question for joined pairs, then optional reminders). `:40` → `/api/cron/turn-reminder`. Both idempotent. |
| Database, auth, realtime | Supabase project `digbnrhwsifmycrxyquo` (us-east-1, Pro plan) | RLS is the security boundary. The old pg_cron `assign-daily-prompts` job was unscheduled on 2026-11-05; the Worker cron now creates daily questions. |
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
| `RESEND_API_KEY` **and** `NOTIFY_SECRET` | No notification email. Both are needed: there is no fallback for `NOTIFY_SECRET` (it signs unsubscribe links). This is treated as a misconfiguration, not a quiet mode: `/api/health` shows `"notifications":{"email":false}`, every hourly cron tick raises a `NotificationConfigError` (Sentry and Workers Logs, `notify_misconfigured`), and each notification that could not go out is counted in `audit_log` (`notify.skipped_config`). |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | No web push; the Account toggle is hidden. Generate once with `node scripts/vapid-keys.mjs --wrangler`. A new pair retires every existing subscription. |
| `CRON_SECRET` | Cron routes return 401; today's question is still created on visit, but no reminders and no pre-creation. |
| `SENTRY_DSN` | No error alerts. Workers Logs still record errors. |
| `GA4_API_SECRET` | Server-side GA4 events are skipped (they are currently disabled pending consent gating anyway). |

## 3. Verify a deploy

1. GitHub → Actions → the CI run for the merge commit: `web`, `database`, `e2e-core`, `e2e-vinext` green, then `deploy-cloudflare`.
2. `curl -s https://relationshipcopilot.com/api/health` returns `{"ok":true,"commit":"<sha>","notifications":{"email":true,"push":true}}`. `email` must be `true` (if not, `RESEND_API_KEY` or `NOTIFY_SECRET` is missing; secrets take effect without a redeploy). The sha must be the tip of `main`. If it is older, a deploy was skipped or failed: re-run the `deploy-cloudflare` job on the tip commit.
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

- Sentry: any new issue, or a failed cron monitor (`daily-reminder`, `turn-reminder`). A `NotificationConfigError` issue means email is off.
- Notifications are going out: `docs/metrics.sql` §5. `skipped_config` must be 0 for the day.
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
| Blueprint or digest "couldn't finish" | Workers Logs for `[grok] Grok request failed (<kind> <status>)`; `audit_log` rows `blueprint.output_rejected` / `digest.output_rejected` (`meta.reason`); xAI status | `rejected 404/400`: bad model id (`XAI_MODEL`). `rejected 401/403`: bad key. `rate_limit` / `server` / `timeout`: provider trouble, already retried once; wait. `config`: key or `XAI_NO_TRAINING_DPA` missing. An `output_rejected` row means the model wrote something we refuse to show (empty, a diagnosis, "you should leave", a score); a run of them after a model change means run `npm run eval:ai`. Nothing is lost either way; the free Blueprint is given back on failure. |
| "Today's limit for regenerating" | `relationship_insights` for the connection, last 24h | Working as intended: 5 Blueprints per connection per day (`BLUEPRINT_DAILY_MAX`, `web/app/actions/blueprint.ts`). |
| No notification email | `/api/health` → `notifications.email`; `docs/metrics.sql` §5; Resend dashboard | `email:false`: set `RESEND_API_KEY` and `NOTIFY_SECRET` (`npx wrangler secret put NAME --name relationship-copilot`). `email:true` but nothing in `notification_log`: Workers Logs for `[email] provider rejected send <status> <code>` (unverified domain, bad key). A send that fails is retried once on the spot, and a missed "your turn" or reveal is retried by the hourly `turn-reminder` job (the `sweep` block in its `cron_tick` log line; needs migration 0048). |
| Email was off for a while; who gets what when it comes back? | `turn-reminder` `cron_tick` → `sweep` | Each person still being waited on gets one "your turn" email for their latest unanswered set (not one per set), at the next `:40` inside 9am–8pm their time, for answers up to 14 days old. Reveals older than a day, joins and discussion replies are not re-sent. |
| No daily question | Workers Logs for `/api/cron/daily-reminder` | Today's question is also created when either person opens the connection. |
| Safety | `safety_events` (metadata only) | Review new rows weekly. Never contact a user about one, and never tell the other person. |

## 9. Smoke test (before launch and after risky deploys)

Most of the old two-account walkthrough now runs on every PR and every push to `main`, in the `e2e-core` CI job (`web/e2e-core/`), against a local Supabase with every migration applied. Email and Stripe go to a fake on the CI machine (`web/e2e-core/fake-providers.mjs`); nothing is sent or charged. If `e2e-core` is green on the commit that is live (§3), these are already checked and do not need repeating by hand:

| Flow | Spec |
| --- | --- |
| Create a connection, invite, join, answer in private, mutual reveal; an outsider is shut out | `core-loop.spec.ts` |
| Today's question from the day both join; the invitee names themselves in place; nothing AI is sold while AI is off | `launch-readiness.spec.ts` |
| An earlier day comes back as "waiting on your answer" | `catch-up.spec.ts` |
| Emails for joined, your turn, reveal and discussion reply: right person, right link, unsubscribe headers, never any answer text; the unsubscribe link; the hourly job re-sends a missed "your turn" once | `notifications.spec.ts` |
| Upgrade opens Checkout for the right person, the signed webhook unlocks Premium (a forged or repeated one does not), Manage billing opens the portal, cancellation returns to Free | `billing.spec.ts` |
| Data export; account deletion ("redact, partner keeps theirs", connection archived, Stripe subscription cancelled first) | `account.spec.ts` |

What CI cannot see is the production wiring: real sign-in, real delivery, real money, and the real AI provider. That is all that is left to do by hand, with two real accounts (A and B) on https://relationshipcopilot.com:

1. **Sign-in.** A signs in with Google. B asks for an email link on a different device and it arrives within a minute and signs B in. (Checks Google OAuth, Turnstile and the Supabase auth email setup.)
2. **A notification email really arrives.** A creates a connection and shares the invite; B joins. A receives "B joined" in a real inbox, not in spam, and the button opens the connection on the production domain. Then open the "stop these emails" link from that email and confirm the page loads (do not press the button unless you want them off). (Checks `RESEND_API_KEY`, `NOTIFY_SECRET`, the sending domain and `NEXT_PUBLIC_SITE_URL`.)
3. **The reveal arrives live.** Both open today's question. A answers, then B answers while A's page is still open: A's page shows the reveal without a reload. (Checks Supabase Realtime in production; CI reloads the page.)
4. **Push, if you use it.** Turn on notifications on one phone from Account and confirm one arrives on the next "your turn". (Checks the VAPID keys and the service worker.)
5. **AI, once it is switched on.** Generate the free Blueprint; confirm a second attempt asks for Premium. Skip while pricing says "Opening soon".
6. **Real money, once Premium is open.** A buys Premium with a live card. The account page shows Premium within a few seconds (this is the production webhook endpoint and its signing secret). Manage billing opens the Stripe portal; cancel there, and Stripe shows the subscription ending at period end. Refund the charge in the Stripe dashboard afterwards.
7. **The scheduled jobs are firing.** An hour later, the Worker's logs show `cron_tick` lines for the daily and turn reminders with no `notify_misconfigured` (§7).
8. **Analytics reports.** In a private window, press Accept on the cookie banner on the home page; GA4 → Realtime shows the visit within a minute. (CI checks that nothing loads before Accept and that the Google tag is requested after it, with Google's servers stubbed; that the container then reports is only visible in GA4.)

Deleting a test account and downloading an export no longer need a production check; if you created throwaway accounts for the steps above, delete them from Account when you are done.

To run the automated part yourself (needs Docker):

```bash
cd web
./scripts/e2e-core-stack.sh ./e2e-core.env && set -a && . ./e2e-core.env && set +a
NEXT_PUBLIC_SITE_URL=http://localhost:3100 npm run build
npm run test:e2e:core
```
