# Relationship Copilot

**Better relationships, cradle to grave — romantic, friend, family, coworker, parent–teen.**

Relationship Copilot is built around two ideas:

1. **The mutual-reveal question loop.** Two people answer the same questions —
   a 20-question onboarding, a daily question, quizzes and challenges — and
   neither can see the other's answer until they've submitted their own. The
   reveal gate is enforced in Postgres Row-Level Security, not application
   code, so no app bug can leak an answer early.
2. **The AI Relationship Blueprint.** A server-side, PII-redacted, safety-gated
   AI reflection on a connection's answers (premium). Safety detection runs for
   everyone, free, always: high-severity signals (self-harm, violence, abuse)
   withhold AI output and surface crisis resources instead.

## Stack

- **Supabase** — Postgres, Auth, Realtime, Row-Level Security (`supabase/`)
- **Next.js (App Router) on Vercel** — UI, server actions, route handlers (`web/`)
- **Grok (xAI)** — question/insight generation and safety classification, server-side only
- **Stripe** — freemium billing; safety features are never paywalled

See [NEW_ARCHITECTURE.md](NEW_ARCHITECTURE.md) for the design and
[web/README.md](web/README.md) for app-level docs.

## Repository layout

```
web/                  Next.js app (the product)
supabase/migrations/  Database schema, RLS policies, seeds — apply in order
supabase/tests/       SQL tests for the reveal gate and daily loop (plain Postgres)
docs/                 Design references (incl. the legacy Agent SDK spec)
```

## Quick start

```bash
cd web
cp .env.example .env.local   # fill in Supabase / Stripe / xAI keys
npm install
npm run dev                  # http://localhost:3000
```

Apply `supabase/migrations/*.sql` to your Supabase project in filename order.

### Tests

```bash
# App unit tests (safety, redaction, blueprint parsing, streak, compat)
cd web && npm test && npm run typecheck

# Database: migrations + RLS reveal-gate tests against a throwaway Postgres
docker compose up -d
PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres ./supabase/tests/run.sh
```

## Safety & privacy principles

- **Safety is never behind the paywall.** `/safety` and crisis-resource
  surfacing are free for everyone, signed in or not.
- **Redact before anything leaves our boundary.** Names, emails, and phone
  numbers are stripped before any text reaches the AI provider.
- **The database is the security boundary.** Access control lives in RLS;
  the service-role client is used only for trusted writes after explicit
  authorization checks, and sensitive actions are audit-logged.
- **Your data is yours.** Full JSON export and account deletion are built in.
  Deletion removes everything you wrote; a partner keeps their own answers.

## History

The original Express/React monorepo (`server/`, `client/`, `shared/`) was
superseded by this stack and removed; it is preserved in git history (last
present at commit `f5704eb`, tag `legacy-monorepo`) and its agent integration
spec lives on in [docs/agent-sdk.md](docs/agent-sdk.md).

## License

MIT — see [LICENSE](LICENSE).
