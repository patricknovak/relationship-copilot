# GA4 north star: `first_mutual_reveal_completed`

**Property:** `G-3HE7V5FTSR`  
**GTM container (marketing pages):** `GTM-NT4DZRHK`  
**Exact event:** `first_mutual_reveal_completed`

## What fires

When a connection’s **first** mutual reveal completes (both members have shared;
`prompt_instances.status` flips to `revealed` and it is that connection’s only
revealed instance), the server sends this event once via the GA4 Measurement
Protocol.

It does **not** fire for:

- landing / marketing pageviews
- invite sent
- partner joined (before reveal)
- Premium checkout (separate secondary funnel — not this north star)
- Rel activation drip email opens/clicks (**drip = NO SEND / drafts only**)

## Why Measurement Protocol (not a GTM tag on `/connections`)

GTM loads only on the public marketing surface (`web/lib/analytics.ts`).
Authenticated routes (`/connections`, `/account`, `/onboarding`, `/auth`,
`/invite`) never load the container, so connection and invite IDs in the URL
never reach Google.

The north-star conversion therefore lands in the **same GA4 property**
(`G-3HE7V5FTSR`) from the server, with an anonymous `client_id` and **no**
user, connection, or invite identifiers.

Marketing traffic still arrives through GTM `GTM-NT4DZRHK`.

## Production env

Set in Vercel (Production):

```bash
GA4_MEASUREMENT_ID=G-3HE7V5FTSR
GA4_API_SECRET=...   # Admin → Data streams → Web stream → Measurement Protocol API secrets
NEXT_PUBLIC_GTM_ID=GTM-NT4DZRHK
```

Unset secrets ⇒ tracking no-ops (correct for local/preview).

## Admin: mark as Key event ON

After a real (or DebugView) completion lands the event:

1. Open GA4 property **G-3HE7V5FTSR**.
2. **Admin → Data display → Events** (or **Configure → Events**).
3. Find the exact name `first_mutual_reveal_completed`.
4. Turn **Key event** **ON** for that row only.
5. Do **not** promote funnel siblings (`invite_sent`, `partner_joined`,
   `premium_checkout_started`) or any email/drip activity as this north star.

Until Key event is ON and Brand QA has a labeled pull, digests should say
**not measured** for mutual-reveal completions.

## Rel activation drip

**NO SEND.** Drafts only — do not send Rel activation drip mail, and do not
count draft opens/clicks as conversions or digest rows.

## Brand QA checklist

- [ ] Event fires **once** when the first mutual reveal completes.
- [ ] No fire on landing, invite alone, partner join alone, Premium checkout, or drip drafts.
- [ ] Event name is exactly `first_mutual_reveal_completed`.
- [ ] Property `G-3HE7V5FTSR` (marketing via GTM `GTM-NT4DZRHK`).
- [ ] Admin Key event ON; labeled [GA4] counts only after that.
