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
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests (`lib/**/*.test.ts`) |
| `npm run test:e2e` | Playwright against `next start` (build first). Optional `E2E_STORAGE_STATE` for a signed-in hub check; leave `RESEND_API_KEY` unset so drip/notification mail stays NO SEND. |

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

See `../docs/ROADMAP.md`. The sections above describe the first slice; the
app now covers connections, onboarding + mutual reveal, the daily loop,
electives, the library, the premium AI Blueprint/digest, billing, account
lifecycle, and notification email (`lib/notify.ts`, `lib/email.ts`).

## Auth provider config

Magic-link + Google OAuth require, in the Supabase dashboard, a redirect URL of
`<site>/auth/callback` and (for Google) the OAuth provider enabled.
