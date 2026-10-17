# Product roadmap

Reviewed 2026-10-13 against the live product, the production database, and
the 2026 couples/relationship-app market. This is the single development plan;
`docs/launch-checklist.md` tracks the non-code go-live items it depends on.
Update both as items land.

## 1. Where we are

**Built and live** (`main`, production at relationshipcopilot.com, Vercel):
the mutual-reveal loop with the gate in RLS; seven relationship types, each
with a "first 10–20" onboarding pack; a daily question with Realtime reveal,
streaks, and "Looking back"; quizzes and challenges; a public library; the
premium AI Blueprint and weekly digest (redacted, safety-gated); Stripe
billing with a portal; data export and "redact, partner keeps theirs"
deletion; an on-brand invite loop (email, share sheet, OG card, .ics
reminder) with a GA4 funnel; security headers, CSP, Turnstile; a Cloudflare
Workers build ready behind a flag.

**Real usage is effectively zero.** Production as of 2026-10-13:

| Metric | Value |
| --- | --- |
| Profiles (mostly our own test accounts) | 8 |
| Connections created / active | 4 / 1 |
| Prompt responses ever | 3 |
| Discussions, AI insights, premium subscribers | 0 / 0 / 0 |

The code is ahead of the business: three launch blockers are still open and
none are code (Stripe account activation and portal config, the Turnstile
secret for magic-link sign-in, and the xAI no-training agreement that gates
every AI call in production). Until those close, no premium feature can be
sold and only Google sign-in works.

## 2. Market read (October 2026)

| Product | Shape | Price | What it has that we don't |
| --- | --- | --- | --- |
| Paired (8M+ downloads) | Daily question + quizzes + games, couples only | ~$30–60/yr, $15/mo; free tier is one teaser question a day | 1,000+ activities, native app, push, polished habit loop |
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

**Where we are genuinely differentiated** and should double down:

1. **Every relationship, not just couples.** Nobody credible serves friends,
   siblings, family, coworkers, mentors and parent–teen in one product with
   the same mechanic. Search demand for "questions for my sister/dad/best
   friend" exists and is unserved by apps.
2. **The reveal gate is enforced in the database.** A marketing claim we can
   back ("no app bug can leak an answer early") that no competitor makes.
3. **Safety and privacy first.** Free, always-on safety detection; redaction
   before anything reaches a model; export and delete built in; no analytics
   inside the signed-in app. The AI-coach entrants are weakest here.
4. **AI that reflects on what both people actually said** (Blueprint, digest)
   rather than a chatbot one person consults about the other. This is the
   honest, non-therapy position; keep it.

**Where we are behind** and it matters:

1. **Content depth.** The daily pool is 6–13 type-specific questions plus 13
   shared ones: a pair sees repeats in about three weeks. Competitors have
   hundreds to a thousand. This is the cheapest high-value fix available.
2. **No notifications at all.** Nothing tells you your person answered, that
   a reveal happened, or that today's question is waiting. The habit loop
   depends entirely on remembering to open a website. Every competitor has
   push; the category's own complaint data says 1–3 notifications a week is
   the sweet spot.
3. **The daily loop is hidden.** The connection page shows a button, not the
   question, and the connections list gives no "your turn" signal.
4. **Price and plan shape.** $18/mo with no annual plan is 2–3x the market
   and the subscription covers one person, while Paired and Connected cover
   both partners. The free tier is generous (right call), but the premium
   offer is weak relative to price while AI is blocked.
5. **No native app or push.** Acceptable for now (PWA manifest exists); email
   closes most of the gap for a web-first product.
6. **Rough edges a first real pair would hit** (from a full code walk on
   2026-10-13): the connections list and hub never show the other person's
   name, only "Romantic partner"; every reveal reuses the first-reveal hero
   and its "continue" link goes to the hub instead of today's question; the
   Blueprint page says "your 20 answers" for 10–12 question packs; the
   love-languages quiz asks for "any that resonate" but renders single-choice;
   "Leave this connection" has no confirmation; Safety lists US lines only
   (the founder is in Vancouver); "today" and streaks flip on the UTC date;
   intake goals, values and attachment style are collected but never used by
   the Blueprint; quizzes have a scoring config that nothing reads.

## 3. Goals (unchanged) and the strategy this implies

Better relationships, cradle to grave, for every relationship type, with the
reveal gate, safety, and privacy as non-negotiables, and most of the product
free. The implication for the next quarter: **win on breadth and trust, not
on an AI chatbot.** Make the free daily habit excellent and deep enough to
retain real pairs for months, make the product reach people when it is their
turn, then sell a reflective AI layer priced like the market, covering both
people in a connection.

## 4. Prioritized plan

Order is by value to a real pair using the product this month, divided by
cost. Items marked **(code)** are engineering; **(Patrick)** need a decision
or an account action.

### Now

1. **Deep daily pools for every type (code). Shipped 2026-10-13 (0020).** Ship 50+ framework-grounded
   daily questions per relationship type plus a larger shared pool so a pair
   goes months without a repeat. Keep the existing format mix (free text,
   scale, choice). Migration-only; no app changes.
2. **Today's question inline + "your turn" everywhere (code). Shipped 2026-10-13.** The
   connection page shows today's question text and its state (answer now /
   waiting on them / revealed, with a link to discuss). The connections list
   shows a "your turn" badge per connection. Both read through RLS as today.
3. **Transactional email notifications (code, then one env var). Code shipped 2026-10-13; needs `RESEND_API_KEY` and the cron schedule (launch checklist §4).** Five
   emails, none containing answer or message text: "they joined", "they
   answered, your turn", "you both revealed, see it side by side", "they
   wrote in a discussion" (first reply per reveal), and an opt-in daily
   "today's question is ready". Per-user preferences on `/account` (stored in
   `profiles.preferences`), unsubscribe in one click, never sent about safety
   resources or leaving a connection. Sender is Resend's HTTP API (the
   domain's DKIM is already set up for Resend via Supabase SMTP); the whole
   feature no-ops without `RESEND_API_KEY`, and the daily reminder is a
   secret-protected route handler that pg_cron calls.
4. **Quick wins from the walk-through (code). Shipped 2026-10-13**, including the day boundary: each connection now has a time zone (0025) and "today", the streak and the reminder window follow it, and dimension-scored quizzes (attachment) now show each person's reflection on the revealed view. Show the other person's
   name on the list and the hub; first-reveal hero only on the first reveal,
   with the continue link going to today's question; correct the "20
   answers" copy; add Canadian safety lines; confirm before leaving a
   connection; make the love-languages quiz multi-select or reword it.
5. **Close the launch blockers (Patrick).** In order of unlock: Stripe
   activation + portal config (sells premium); Turnstile secret (email
   sign-in); the AI provider decision below.
6. **AI provider decision (Patrick).** `XAI_NO_TRAINING_DPA` has gated every
   production AI call since June. Either confirm the xAI agreement, or switch
   to an API whose commercial terms already exclude training on API traffic
   (Anthropic's and OpenAI's do by default). The client in `web/lib/grok.ts`
   is OpenAI-compatible, so a base URL, key and model change covers most of
   the switch. Nothing premium can be demonstrated until this closes.

### Next

7. **Premium covers the connection (code). Shipped 2026-10-13** as
   `connection_has_premium` (migration 0022): if either member is premium,
   Blueprint and digest work for that connection. Matches Paired and
   Connected, removes the "I paid, why can't my partner see it" complaint
   before it happens.
8. **Annual plan and a market price (Patrick + code).** Code shipped
   2026-10-13: checkout takes a monthly or yearly interval and `/pricing`
   shows the yearly button once `NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_ANNUAL` and
   its display string are set. Still Patrick's: create the price and decide
   the numbers. Recommendation: $9.99/mo or $59.99/yr, one subscription
   covers both people. Keep "cancel anytime" and no auto-converting trial;
   the market's loudest complaint is trial-to-annual surprise charges.
9. **Reactions on revealed answers (code). Shipped 2026-10-13 (0023).** One
   tap ("❤️", "😂", "🥹", "👀") per answer, shown to both, as a lighter step
   than a discussion reply. Cheap, measurable lift on the loop in competitor
   apps.
10. **More quizzes and challenges for the non-romantic types (code). Shipped
    2026-10-13 (0024):** two quizzes and two challenges per non-romantic
    type plus two shared ones; every type now has 6–7 quizzes and 6–9
    challenges available.
10b. **Public "questions for your…" pages per relationship type (code). Shipped 2026-10-13 (`/for/partners`, `/for/friends`, `/for/siblings`, `/for/family`, `/for/parents-and-teens`, `/for/coworkers`, `/for/mentors`).**
    Differentiator 1 has no landing page: searches like "questions to ask my
    sister" or "conversation starters for mentors" are unserved by apps.
    One public page per type with sample questions from the pool, an FAQ
    with schema markup, and the invite CTA; listed in the sitemap.
10c. **History of past reveals (code). Shipped 2026-10-13 (`/connections/[id]/history`).** "Looking back" resurfaces two
    moments; there is no way to browse everything a pair has revealed.
    A per-connection history page, newest first, read under RLS.
11. **Web push (code). Shipped 2026-10-17 (0034); needs a VAPID key pair (launch checklist §4).**
    Moved ahead of "email first": push needs no third-party account (the
    keys are self-generated and browser push services are free), while
    email still waits on `RESEND_API_KEY`. Same preference switches and
    once-only log as email; a notification goes out on every channel that
    is set up. Payloads are RFC 8291-encrypted to the browser and carry a
    first name and a generic line only. Account → "Notifications on this
    device"; signing out stops a shared browser's alerts. iPhone needs the
    site added to the Home Screen first (the toggle says so).
12. **Cloudflare cutover (Patrick + code).** Playbook is written; the
    `workers.dev` test deploy is waiting on a go. Keep Vercel as fallback.

### Later

13. **Blueprint v2: longitudinal.** First step shipped 2026-10-13: the
    prompt now appends the pair's last 20 revealed daily answers and asks
    for "then vs now". Still open: using each person's private intake
    (goals, values, attachment) in a *shared* Blueprint needs an explicit
    consent step, since intake is collected as private; do not feed it in
    silently.
14. **Shared goals and rituals. Shipped 2026-10-13 (0030):** a both-edit
    "things we're trying" list on the hub (members only, visible
    immediately, survives a member's deletion), fed to the weekly digest as
    context.
14b. **Scheduled weekly digest.** The digest is still a manual button. A
    cron needs a service-role read of revealed-only responses, which the
    "never read responses through the admin client" rule currently forbids;
    decide whether a narrowly scoped `revealed_responses_for_digest`
    SECURITY DEFINER function is acceptable before building it.
15. **Parent–teen consent flow (COPPA / GDPR-K)** before under-13 use.
16. **Native wrapper** (Capacitor) if push + PWA prove insufficient for
    retention on mobile.

### Not doing (and why)

- **Conversational AI coach / chat.** It is the crowded, undifferentiated
  end of the market, invites one-sided use against a partner, and is the
  hardest to keep safe. Our AI stays reflective and mutual.
- **Conflict recording / analysis.** Requires audio consent flows and
  retention guarantees we cannot audit; off-strategy for a trust-first brand.
- **Paywalling daily questions.** The category's number-one complaint.
- **Zodiac beyond "just for fun".** Keep it entertainment-framed as today.

## 5. Status after the 2026-10-13 build (PR #81)

Shipped on the branch, in order of roadmap value: daily pool depth (0020),
today's question inline with your-turn state and a weekly suggested
activity, five notification emails with preferences and one-click
unsubscribe (0021/0026/0027), premium covering the connection and optional
annual price (0022), reactions (0023), electives for every type (0024) and
a real first 20 everywhere (0029), public `/for` pages with four new
library articles (0028), reveal history, quiz reflections, connection
time zones (0025), the Blueprint reading recent dailies, shared goals
(0030), and the walk-through quick wins. All migrations are additive and
tested; the reveal gate is untouched.

**What only Patrick can do next**, in order of unlock:

1. Apply migrations 0020–0030 to production (launch checklist, "Already
   done" and §4).
2. Stripe activation + customer portal configuration, then a live
   checkout test (checklist §1). Optionally create the annual price.
3. The Turnstile secret in Supabase so email sign-in works (checklist §2).
4. `RESEND_API_KEY` + `CRON_SECRET` and the two pg_cron schedules, so the
   notification loop actually runs (checklist §4).
5. The AI provider decision (`XAI_NO_TRAINING_DPA`, or a provider whose
   terms already exclude training), which unlocks everything premium.
6. Decide the price (recommendation: $9.99/mo or $59.99/yr, one plan covers
   both people) and update the four places that say $18/mo.

**Next engineering items**, once the above lands: scheduled weekly digest
(needs the design call in 14b), web push (11), Cloudflare cutover (12).

## 6. What to measure

The north star stays `first_mutual_reveal_completed`. Add, as the funnel
fills: pairs with a revealed daily in the last 7 days (the habit), day-30
retention of pairs, notification open-to-answer rate, and premium
conversion after the first Blueprint. All of these are derivable from
`prompt_instances` and `relationship_insights` without new tracking.
