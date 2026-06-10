# Relationship Copilot — New Architecture (Supabase · Next.js/Vercel · Grok)

This is the re-platform of Relationship Copilot onto the org-standard stack. It
makes the **mutual-reveal question loop** and the **AI Relationship Blueprint**
the spine of the product, for *all* relationship types (romantic, friend,
family, coworker, parent–teen). Full design lives in the approved plan.

> The legacy Express/React monorepo (`server/`, `client/`, `shared/`) has been
> removed from `main` (preserved in git history at commit `f5704eb`, tag
> `legacy-monorepo`); its agent integration spec is kept as a design reference
> in `docs/agent-sdk.md`.

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

## Implemented (Phases 0–6)

The full MVP is built across `supabase/migrations/` (0001–0006) and the Next.js
app in `web/`:

- **Auth & shell** — Supabase Auth (magic link + Google), session middleware,
  always-free `/safety`, landing.
- **Identity** — `/onboarding` intake + short attachment reflection; `/account`;
  zodiac (entertainment-framed, never used in guidance).
- **Connections & mutual reveal** — create + `/invite/[code]` accept, the
  20-question onboarding, and the side-by-side reveal + discussion, all gated by
  the reveal RLS/trigger.
- **Daily loop** — `ensure_daily_prompt` / `assign_daily_prompts` (+ pg_cron),
  Supabase Realtime live reveal (`RevealWatcher`).
- **Elective content** — quizzes & challenges on the engine (`/explore`),
  type-specific packs incl. the romantic dating-decision reflection, and the
  education `/library`.
- **AI Blueprint (Grok)** — server-side only, **PII redaction**, balanced/
  non-diagnostic prompt, **abuse/self-harm detection** that withholds output and
  surfaces help; **premium-gated** generation. Safety detection is free for all.
- **Billing** — Stripe checkout + signature-verified webhook syncing
  `subscriptions`; `has_premium()` is the entitlement source of truth.
- **Parent–teen track** — emotion-coaching content; trust-first, teen-revocable
  (`leaveConnection`), with an honest COPPA/consent notice.
- **Legacy ports** — daily **streaks** and **zodiac compatibility** (fun).
- **Account lifecycle & hardening** — JSON **data export** and **account
  deletion** ("redact, partner keeps theirs"; migration 0007), audit log,
  Stripe webhook idempotency, validated post-login redirects, model-backed
  safety classification (regex fast path + escalate-only LLM pass).

Safety-critical pure logic (redaction, safety detection, blueprint parsing,
streak, compatibility) is unit-tested with vitest.

## Before a real launch (not code)

- Safety sign-off + legal/privacy review; an **enterprise xAI DPA**.
- Full **COPPA / GDPR-K** verifiable-consent flow before enabling under-13 use.
- Provision the Supabase project + xAI/Stripe keys (`web/.env.example`) and run
  end-to-end.

See `web/.env.example` for required configuration.
