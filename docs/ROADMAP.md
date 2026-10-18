# Product roadmap

Reviewed 2026-10-18 against the live product (now on Cloudflare), the
production database, the codebase, and the 2026 relationship-app market.
This is the single development plan; `docs/launch-checklist.md` tracks the
non-code go-live items it depends on. Update both as items land.

## 1. Where we are

**Built and live** (`main`, production at relationshipcopilot.com on a
Cloudflare Worker since 2026-10-18, placed in `aws:us-east-1` next to the
database): the mutual-reveal loop with the gate in RLS; seven relationship
types, each with a real "first 20"; a daily question with Realtime reveal,
streaks, reactions and history; quizzes and challenges for every type; a
public library and `/for/<type>` landing pages with FAQ schema; answer-first
invites with a personal note and a 14-day expiry; five notification kinds by
email and web push with per-user switches, one-click unsubscribe and a
"still your turn" follow-up; the premium AI Blueprint (with an opt-in
profile-reflection step) and a weekly digest written on visit; Stripe
billing with a portal, monthly and yearly; data export and "redact, partner
keeps theirs" deletion; enforced nonce CSP, Turnstile, Sentry with an
allowlist scrubber, two Worker Cron Triggers, and a CI pipeline that runs
unit, SQL and end-to-end tests before every deploy.

**Real usage is still effectively zero.** Production as of 2026-10-18:

| Metric | Value |
| --- | --- |
| Profiles (mostly our own test accounts) | 8 |
| Connections created / active | 4 / 1 |
| Prompt instances / revealed | 25 / 2 |
| Prompt responses ever | 3 |
| AI insights, premium subscribers, push devices | 0 / 0 / 0 |
| Last sign-up | 2026-10-03 |

Nothing that remains is a build problem. The launch blockers are keys and
decisions (Sentry DSN, Stripe price IDs, Resend key, the xAI written
confirmation) and the first real pairs. The reviews below were run to make
sure that when those pairs arrive, the product and the stack are ready for
them and for the marketing that brings them.

## 2. Market read (October 2026, re-checked 2026-10-18)

| Product | Shape | Price | What it has that we don't |
| --- | --- | --- | --- |
| Paired (8M+ downloads) | Daily question + quizzes + games, couples only | ~$30–60/yr, $15/mo; free tier is one teaser question a day | 1,000+ activities, native app, polished habit loop |
| Lasting (Talkspace) | Gottman-based curriculum, couples | ~$12/mo, $78/yr | Structured programs, assessments |
| Connected (2026) | Daily questions + AI coach + "Conflict Analyzer" | $9.99/mo, $59.99/yr, one sub covers both partners | Conversational AI, voice conflict analysis |
| Maia, CoupleWork, Ember | AI coach first, couples | $8–25/mo | 24/7 chat and voice coaching |
| Evergreen, Agapé, Couply, Unseal, Lovvy, I Choose You… | Lightweight daily-question apps, couples | free to $10/mo | Reactions, photo answers, 3 questions/day |
| Gottman Card Decks | 1,000+ free conversation cards | free | Breadth of content |
| Kindling, TeenBridge | Parent–teen conversation apps (new, small) | free/unknown | Nothing we lack; the segment is thin |

**What the market says people want** (consistent across 1–3 star review
analyses): a free tier that is actually usable (Paired's paywall on the second
question is the most-cited complaint), prompts that do not run out or repeat,
reliable "their answer arrived" syncing, and honest subscription terms.

**Where we are genuinely differentiated.** All four claims below were
re-checked against competitor sites and store listings on 2026-10-18; none
of them is made by anyone else, and all four are now true in the product:

1. **Every relationship, not just couples.** Nobody credible serves friends,
   siblings, family, coworkers, mentors and parent–teen in one product with
   the same mechanic. Search demand for "questions for my sister/dad/best
   friend" exists and is unserved by apps. Lead with **friends** in
   marketing: it is the largest segment with no incumbent, the lowest
   emotional barrier to inviting someone, and it sidesteps the crowded
   couples ad auction.
2. **The reveal gate is enforced in the database, not only in the app.** A
   marketing claim we can back and no competitor makes. The site now says it
   the same way everywhere (PR #123).
3. **Safety and privacy first.** Free, always-on safety detection; redaction
   before anything reaches a model; a provider agreement that excludes
   training on user content; export and delete built in; no analytics inside
   the signed-in app; error reports that carry no user text. The AI-coach
   entrants are weakest here.
4. **AI that reflects on what both people actually said** (Blueprint,
   digest) rather than a chatbot one person consults about the other. This
   is the honest, non-therapy position; keep it.

**Where we are behind** and it matters:

1. **No one can try the AI before paying.** Premium is the only way to see
   a Blueprint, and nothing in the free loop shows what it is like. One free
   Blueprint per connection, after the first reveal, is the cheapest
   conversion lever we have (item 4).
2. **The inviter's wait is dead time.** Answer-first helps, but after
   answering the hub offers nothing until the other person joins; the
   invitee has no reason to hurry beyond the note. A "while you wait" block
   and a resend path close this (item 5).
3. **Push on iPhone needs the Home Screen** and nothing asks for it. An
   install nudge after the first reveal turns a web page into something that
   can reach people (item 6).
4. **No native app.** Still acceptable (PWA plus push); revisit only if
   retention data says mobile is where pairs drop.

## 3. Goals (unchanged) and the strategy this implies

Better relationships, cradle to grave, for every relationship type, with the
reveal gate, safety, and privacy as non-negotiables, and most of the product
free. **Win on breadth and trust, not on an AI chatbot.** The free daily
habit is now deep enough to retain a pair for months and reaches them when
it is their turn. What is left: let people taste the AI layer, remove the
dead time around the invite, price like the market, and point marketing at
friends first.

## 4. Prioritized plan

Order is by value to a real pair using the product this month, divided by
cost. Items marked **(code)** are engineering; **(Patrick)** need a decision
or an account action. The 2026-10-18 reviews (market, live-site audit,
codebase and stack) produced the items marked **(review)**.

### Now

1. **Keys and IDs (Patrick).** In order of unlock: the two Stripe price IDs
   ($9.99/mo, $59.99/yr, one plan covers both people); `SENTRY_DSN`;
   `RESEND_API_KEY`; confirm `grok-latest` is a valid model id for the
   account (one curl, see PR #103) or set `XAI_MODEL`; file xAI's written
   no-training confirmation and ZDR answer when they arrive. Then the
   Supabase Turnstile secret so email sign-in works.
2. **Merge the remaining review PRs (Patrick) (review).** Merged
   2026-10-18: #121 (deploy only the current tip of `main`), #122 (RLS
   `initplan` rewrite, 12 missing FK indexes, hot-path indexes), #123
   (site quality). Migrations 0038, 0039 and 0040 are applied to
   production. Still open: #124 (reminder crons select in SQL with bounded
   batches; 12-character invite codes), #126 (hub reads in parallel), #127
   (deploy job without a concurrency group, after the three merges in a
   row cancelled the tip's deploy and nothing shipped until a re-run).
3. **Price change PR (code, waits on 1).** `PREMIUM_MONTHLY_USD`, the two
   public price IDs and the annual display string; the pricing page already
   shows the yearly button once the env is set.
4. **One free Blueprint per connection (code) (review).** After the first
   mutual reveal, either member can generate one Blueprint without Premium
   (same redaction and safety gate; one per connection, ever, enforced in
   SQL). Premium keeps unlimited Blueprints, the "then vs now" longitudinal
   view, intake reflections and the weekly digest. Pricing and the reveal
   hero say so; measure conversion after the first Blueprint (§6).
5. **"While you wait" on the hub (code) (review).** When the inviter has
   answered and the invite is pending: the note nudge if none, a one-tap
   resend (share sheet / copy), two library reads for that relationship
   type, and the sample questions for the type. When the invite expires, a
   "get a new link" card instead of a dead button (exists; surface it).
6. **Home-screen install nudge (code) (review).** On mobile, after the
   first reveal, a dismissable card: "Add to Home Screen to get a nudge when
   it is your turn", with the iPhone steps; shown once. Manifest icons and
   short name landed in #123.
7. **Cloudflare hardening (Patrick) (review).** A rate-limiting rule on
   `/invite/*` and `/login` (launch checklist §5); confirm `cron_tick` lines
   at :20 and :40 in Workers Logs; retire the Vercel project and remove its
   Supabase integration. Delete the eight stale remote branches.

### Next

8. **Hub reads in parallel (code) (review).** The connection page runs
   about fifteen sequential queries per view. Group the independent ones
   with `Promise.all` (members + my name + onboarding instance + streak
   dailies + today's daily; then the dependent name, response and suggestion
   reads). No behaviour change; roughly halves the hub's server time. A
   single `hub_snapshot` RPC is the step after, if the page is still the
   slowest signed-in route.
9. **Prerender the marketing pages again (code) (review).** The nonce CSP
   makes every HTML route dynamic (`docs/CLOUDFLARE_MIGRATION.md`). Move the
   static pages (`/`, `/about`, `/pricing`, `/for/*`, `/library/*`,
   `/questions/*`, legal pages) to a hash-based `script-src` for their inline
   scripts so they prerender and edge-cache; keep the nonce for signed-in
   pages. Measured win: those pages are what ads and search send people to.
10. **Account deletion in one transaction, Stripe customer removed (code +
    Patrick decision) (review).** Today the steps run one after another
    from the action and the Stripe customer object survives (subscription is
    cancelled). Move the database steps into one RPC and delete the Stripe
    customer when the subscription is gone. Patrick decides whether the
    customer record should outlive the account for accounting.
11. **Discussion replies through the safety scan (code) (review).**
    Replies are capped like answers but are the one user text that bypasses
    `assessSafety`. Run the regex fast path on post and surface resources
    on a high-severity hit like answers do; nothing else changes.
12. **Tests for `lib/notify.ts` and `lib/weeklyDigest.ts` (code) (review).**
    The notification orchestrator (claim, release on failure, channel
    fan-out) and the digest trigger are the two untested safety-adjacent
    libs. Mock the admin client; no network.
13. **Realtime fan-out (code, when needed) (review).** Reveal updates use
    `postgres_changes` filtered per instance, which Supabase evaluates per
    subscriber. Fine to a few thousand concurrent viewers; past that, switch
    the reveal signal to a broadcast channel keyed by instance.
14. **Friends-first marketing (Patrick + code).** `/for/friends` becomes
    the primary landing page for paid social; one library article per type
    answering the exact search ("questions to ask my sister", "how to
    reconnect with an old friend"), each ending in the invite CTA; the share
    card and the invite message get a friends variant. Track
    `invite_accept_rate` by type (§6).
15. **Retire the pg_cron daily assigner (Patrick) (review).** With 0040 the
    Worker cron creates each connection's daily inside its local window, so
    the 08:05 UTC `assign-daily-prompts` job in Supabase is redundant. Keep
    it for a week after #124 deploys, confirm the Worker log, then
    unschedule it.

### Later

16. **Blueprint v2** stays as shipped (longitudinal "then vs now", consent
    step). Next: a short "what to try this month" section that reads the
    pair's shared goals list and their last digest.
17. **Reminder cadence.** When more than about a thousand people are opted
    in to the daily reminder, change the Cron Trigger from hourly to every
    15 minutes; the routes already batch and report `more`.
18. **Parent–teen consent flow (COPPA / GDPR-K)** before under-13 use.
19. **Native wrapper** (Capacitor) if push + PWA prove insufficient for
    retention on mobile.

### Not doing (and why)

- **Conversational AI coach / chat.** It is the crowded, undifferentiated
  end of the market, invites one-sided use against a partner, and is the
  hardest to keep safe. Our AI stays reflective and mutual.
- **Conflict recording / analysis.** Requires audio consent flows and
  retention guarantees we cannot audit; off-strategy for a trust-first brand.
- **Paywalling daily questions.** The category's number-one complaint.
- **Zodiac beyond "just for fun".** Keep it entertainment-framed as today.
- **Unbounded cron fan-out inside one Worker invocation.** The subrequest
  budget is fixed; batches plus the once-only log are the design.

## 5. Status after the 2026-10-18 reviews

**Shipped between 2026-10-13 and 2026-10-18** (all merged to `main`):
answer-first invites (0033), web push (0034), the invite note (0035), the
"still your turn" follow-up (0036), the Blueprint consent step (0037),
`grok-latest` as the default model with `XAI_MODEL` override (#103), Sentry
on the Worker with the allowlist scrubber and cron monitors (#104), the
weekly digest on visit (#105), the Cloudflare cutover with region placement
and the Worker-level `www` redirect (#106), and the DNS swap. Migrations
through 0037 are applied to production; the Worker holds its ten secrets
(Supabase, Stripe, xAI with `XAI_NO_TRAINING_DPA=true`, cron, notify,
VAPID).

**Review PRs:** #121, #122 and #123 merged 2026-10-18 and deployed
(`524624c`); migrations 0038–0040 applied to production the same day. Open
drafts: #124 cron batching and invite codes (0040 is already applied, so it
can merge any time), #126 hub reads in parallel, #127 CI deploy fix.

**Review findings that need no action:** the signed-in loop passes end to
end under Playwright (two users, invite, answer-first, join, both share,
reveal, history, account, Blueprint gate, library) with no console errors;
the public pages are technically clean (headers, CSP, canonical, sitemap,
robots, structured data); the Worker runs in `aws:us-east-1` with the
database; Supabase security advisors show only intentional items.

**Flagged, not fixed in code:** production holds a function
`public.mission_control_counts` (anon-executable, `SECURITY DEFINER`,
passcode-gated aggregate counts) that is not in `supabase/migrations/`.
Either add it as a migration or drop it; schema drift is how the 0012/0014
incidents happened.

**What only Patrick can do next**, in order of unlock:

1. Send the two Stripe price IDs; the Sentry DSN; `RESEND_API_KEY`.
2. Merge #124, #126 and #127 (their migrations are already applied).
3. Confirm `grok-latest` (or set `XAI_MODEL`); file the xAI letter.
4. The Turnstile secret in Supabase so email sign-in works.
5. Cloudflare rate-limiting rule on `/invite/*` and `/login`; retire
   Vercel; delete the stale branches; decide on `mission_control_counts`.
6. Decide item 10 (Stripe customer deletion) and item 15 (pg_cron).

## 6. What to measure

The north star stays `first_mutual_reveal_completed`. Add, as the funnel
fills: pairs with a revealed daily in the last 7 days (the habit), day-30
retention of pairs, notification open-to-answer rate, premium conversion
after the first (free) Blueprint, invite accept rate by relationship type,
and Home Screen installs (the manifest's `start_url` can carry a query
parameter once the nudge ships). All of these are derivable from
`prompt_instances`, `relationship_insights`, `connection_funnel_steps` and
`subscriptions` without new tracking.

Answer-first is measured by the `answered_before_join` funnel step
(`connection_funnel_steps`, plus an anonymous GA4 event): compare the share
of connections reaching `partner_joined`, and the first mutual reveal, with
and without it.
