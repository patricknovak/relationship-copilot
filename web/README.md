# Relationship Copilot — Web

Next.js (App Router) frontend for the Supabase/Next.js/Grok re-platform. See
`../NEW_ARCHITECTURE.md` for the overall design and the database foundation.

## Setup

```bash
cp .env.example .env.local   # fill in Supabase (+ later Grok/Stripe) values
npm install
npm run dev                  # http://localhost:3000
```

## Scripts

| Script | What |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build (also type-checks + lints) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## What's here so far

- **Supabase auth wiring** (`lib/supabase/*`): browser, server (RLS as the
  user), service-role admin (server-only, bypasses RLS), and a middleware
  session refresher that guards protected routes.
- **Auth**: passwordless magic-link + Google OAuth (`/login`,
  `/auth/callback`).
- **Always-free Safety page** (`/safety`) — crisis resources, never paywalled,
  reachable from every screen via the header/footer.
- **Landing shell** (`/`).

## Next

Signup intake + zodiac, connection create + `/invite/[code]` accept, the
20-question onboarding + mutual-reveal UI, then the Grok Blueprint and Stripe
billing. The DB layer (RLS reveal gate, seeds) already lives in
`../supabase/migrations`.

## Auth provider config

Magic-link + Google OAuth require, in the Supabase dashboard, a redirect URL of
`<site>/auth/callback` and (for Google) the OAuth provider enabled.
