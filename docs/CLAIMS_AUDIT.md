# Claims vs product audit (2026-10-16)

Marketing crawl of home, pricing, about, privacy, safety, `/for/*`, library,
JSON-LD, and soft-premium copy against the shipped code. Prefer product fixes;
soften copy only where a claim cannot be true yet.

| Claim | Location | Status | Fix in this PR |
|---|---|---|---|
| Mutual reveal in DB/RLS | Home FAQ, about, pricing, privacy, JSON-LD | **true** | — |
| Seven relationship types | Home, about, `/for/*` | **true** | — |
| Free core + Safety never paywalled | Pricing, home, README | **true** | — |
| Free cap 3 connections / Premium unlimited | Pricing | **true** | — |
| Premium $18/mo Blueprint + digests | Pricing, home, JSON-LD | **true** (code; AI gated by DPA) | Softened AI training / DPA language |
| One Premium covers both in a connection | Pricing FAQ | **true** in code (`connection_has_premium`); needs migration 0022 live | Clarified wording; Patrick: apply 0022–0030 if not already |
| Onboarding “10–20 depending on type” | Pricing Free list | **false** (all packs = 20 via 0029) | Copy → “20 onboarding questions” |
| “Not used to train models” | Home FAQ, about, privacy, Blueprint, soft-premium | **ops-gated** (`XAI_NO_TRAINING_DPA`) | Softened: strip PII; prod AI off until DPA |
| Safety screens + surfaces resources | Home FAQ | **partial** (AI path only before) | **Product:** AnswerForm surfaces resources on high-severity submit; FAQ updated |
| Streaks “miss a day, pick it back up” | Home Features | **partial** (yesterday grace only) | Copy matches `computeStreak` |
| Life-season “packs” | Home Features, about | **partial** (electives/articles) | Softened to optional packs / library reads |
| Research-grounded / weaker ideas flagged | Home Features | **partial** | Softened; library evidence ratings called out |
| Premium education library | Pricing | **partial** (few premium articles) | “Deeper premium library reads” |
| Export JSON / delete (partner keeps theirs) | FAQ, privacy, account | **true** | — |
| Quick exit / never notify on Safety | Safety, FAQ | **true** | — |
| Under-13 not supported | `/for/parents-and-teens`, terms | **true** (honest) | — |

## Rel activation drip

**NO SEND.** Drafts only — do not send Rel activation drip mail
(`docs/ga4-first-mutual-reveal.md`). This PR does not add drip sending.
