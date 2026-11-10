# Relationship Copilot — Web

Next.js (App Router) app for Relationship Copilot. See
`../NEW_ARCHITECTURE.md` for the overall design and the database foundation.

## Setup

```bash
cp .env.example .env.local   # fill in Supabase, Stripe and xAI values
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
| `npm run test:e2e` | Playwright against `next start` (build first), or against the Worker with `E2E_TARGET=vinext` after `npm run build:vinext` (CI runs both). Optional `E2E_STORAGE_STATE` for a signed-in hub check; leave `RESEND_API_KEY` unset so drip/notification mail stays NO SEND. |

## What's here

Connections and invites, the 20-question onboarding with the mutual reveal,
the daily question loop, electives (quizzes, challenges), the library, the
premium AI Blueprint and weekly digest, Stripe billing, account export and
deletion, and notification email and web push (`lib/notify.ts`,
`lib/email.ts`, `lib/webPush.ts`). Supabase clients live in `lib/supabase/*`
(browser, server as the user, and the RLS-bypassing service-role admin
client, server-only). Production is a Cloudflare Worker built with vinext
(`npm run build:vinext`); see `../docs/RUNBOOK.md` for operations and
`../docs/ROADMAP.md` for what's next.

## Auth provider config

Magic-link + Google OAuth require, in the Supabase dashboard, a redirect URL of
`<site>/auth/callback` and (for Google) the OAuth provider enabled.
