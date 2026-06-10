# Relationship Copilot — Development Guide

## Architecture

- `web/` — Next.js (App Router) + TypeScript + Tailwind. The product.
- `supabase/migrations/` — Postgres schema, RLS policies, seed content. Applied in filename order.
- `supabase/tests/` — SQL tests runnable against plain Postgres via `supabase/tests/run.sh` (stubs fake `auth.uid()` etc.).
- `docs/agent-sdk.md` — design reference from the removed legacy platform (tag `legacy-monorepo`).

## Commands

```bash
cd web
npm run dev          # Next.js dev server (port 3000)
npm test             # vitest unit tests
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm run build        # production build

# Database tests (needs a local Postgres, e.g. `docker compose up -d`)
PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres ./supabase/tests/run.sh
```

Environment template: `web/.env.example` (Supabase, Stripe, xAI keys).

## Tech stack

- **Frontend/backend:** Next.js App Router, server actions in `web/app/actions/`, route handlers in `web/app/api/`
- **Database/auth:** Supabase (Postgres + RLS + Realtime + Auth)
- **AI:** Grok (xAI) via `web/lib/grok.ts` — server-side only
- **Billing:** Stripe (checkout server action + signature-verified webhook)
- **Testing:** vitest for `web/lib/*`, SQL tests for migrations/RLS

## Key invariants — do not break these

1. **The mutual-reveal gate lives in RLS** (`supabase/migrations/0001_core_schema.sql`,
   `prompt_responses` policies + reveal trigger). Never re-implement or bypass it
   in app code; never read responses through the admin client for display.
2. **Redact before text leaves our boundary.** Anything sent to the AI provider
   goes through `buildRedactor` (`web/lib/redact.ts`) first.
3. **Safety is free and runs first.** `assessSafety` (`web/lib/safetyClassifier.ts`,
   regex fast path + model escalation) gates AI output; high severity withholds
   the output and surfaces resources. Never paywall safety features.
4. **The service-role client (`web/lib/supabase/admin.ts`) bypasses RLS.** Use it
   only after explicit authorization checks, only in server code, and audit-log
   sensitive actions via `logAudit` (`web/lib/audit.ts`).
5. **Entitlements come from `has_premium()`** (RPC / RLS), synced by the Stripe
   webhook — never trust client-side plan state.
6. **Account deletion = "redact, partner keeps theirs"** (`web/app/actions/account.ts`
   + migration `0007`): the user's content cascades away, shared connections are
   archived for the remaining member, shared AI insights are removed.

## Patterns

- Server actions own mutations; pages are server components reading through the
  user's session client (RLS scopes everything).
- New schema changes = a new numbered migration in `supabase/migrations/`; keep
  `web/lib/database.types.ts` (hand-maintained) in sync.
- Pure, safety-critical logic (redaction, safety, parsing, streaks) lives in
  `web/lib/` with vitest coverage — keep it framework-free and tested.
