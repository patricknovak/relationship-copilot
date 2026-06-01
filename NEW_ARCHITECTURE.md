# Relationship Copilot — New Architecture (Supabase · Next.js/Vercel · Grok)

This is the re-platform of Relationship Copilot onto the org-standard stack. It
makes the **mutual-reveal question loop** and the **AI Relationship Blueprint**
the spine of the product, for *all* relationship types (romantic, friend,
family, coworker, parent–teen). Full design lives in the approved plan.

> The legacy Express/React monorepo (`server/`, `client/`, `shared/`) is kept
> for reference and content porting, and will be removed once superseded.

## Stack

- **Supabase** — Postgres, Auth, Realtime, Storage, Row-Level Security.
- **Next.js (App Router) on Vercel** — UI, server actions, route handlers.
- **Grok (xAI)** — question/insight generation (OpenAI-compatible API), server-side only.
- **Stripe** — freemium billing (most core features free; AI behind a subscription).

## What's implemented so far (this PR)

The **database foundation** — fully migrated and tested:

| File | Contents |
| --- | --- |
| `supabase/migrations/0001_core_schema.sql` | Identity (`profiles` + auto-provision trigger), `connections` + `connection_members`, the unified prompt engine (`prompt_templates`/`prompt_instances`/`prompt_responses`/`prompt_discussions`), `relationship_insights`, `safety_events`, `subscriptions`; helpers `is_connection_member`, `has_answered`, `has_premium`, `accept_invite`; the **reveal trigger**; and **all RLS policies including the mutual-reveal gate**. |
| `supabase/migrations/0002_education.sql` | Education library table + premium gating via `has_premium()`. |
| `supabase/migrations/0003_seed_content.sql` | Framework-grounded **"20 questions"** onboarding packs per type, a daily-question pool, two quizzes (attachment; love-languages, honestly framed), and education articles. |

### The mutual-reveal mechanic (the crux)

You cannot read another member's answer to a prompt until you've submitted your
own. This is enforced **entirely in Postgres RLS** — not application code — so no
bug in the app layer can leak an answer early:

```sql
-- prompt_responses SELECT policy (simplified)
using (
  user_id = auth.uid()                          -- your own answer, always
  or (is_connection_member(<connection>)        -- ...or a co-member's answer
      and has_answered(instance_id, auth.uid()))-- ...only once you've answered
)
```

When the last member answers, an `AFTER INSERT` trigger flips the instance to
`revealed`. Edits freeze on reveal. `has_answered` is `SECURITY DEFINER` to avoid
the self-referential "infinite recursion in policy" error.

## Verifying the database locally

No Supabase CLI required — the migrations run against any Postgres using the
shims in `supabase/tests/00_supabase_stubs.sql` (which fake `auth.users`,
`auth.uid()`, the Supabase roles, and the realtime publication).

```bash
# with a local Postgres reachable at $PGHOST:$PGPORT
PGHOST=/tmp PGPORT=55432 PGUSER=postgres ./supabase/tests/run.sh
```

`supabase/tests/01_reveal_gate_test.sql` asserts, under RLS:
1. a partner's answer is **hidden** before you answer,
2. **both** answers appear once both have answered, and the instance **auto-reveals**,
3. **edit-after-reveal is blocked**, and
4. `accept_invite` adds the member, advances status, and burns the invite code.

On real Supabase, apply the files in `supabase/migrations/` (the stubs file is
local-only and must **not** be applied).

## Next steps (subsequent PRs)

- **Next.js app** under `web/` — Supabase auth (`@supabase/ssr`), the
  signup/intake/zodiac flow, connection create + `/invite/[code]` accept,
  the 20-question onboarding + reveal + discussion UI.
- **Grok engine** — server actions / Edge Functions for the Blueprint + digests,
  with PII redaction and the safety guardrails (balanced framing, abuse/self-harm
  resource routing, human-in-the-loop).
- **Daily loop** — pg_cron + Edge Function assigning daily prompts idempotently
  from a Grok-generated pool; Supabase Realtime for live reveal.
- **Billing** — Stripe checkout + webhook syncing `subscriptions`; entitlement
  gating on AI surfaces (safety always free).
- **Parent–teen track** — after COPPA/GDPR-K compliance work.

See `web/.env.example` for required configuration.
