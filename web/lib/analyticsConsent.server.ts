// Server-only: read analytics consent from the request cookie mirror.
// Consent is primarily localStorage (`rc-analytics-consent`); storeConsent
// also writes the same value as a first-party cookie so MP can gate sends.
// Outside a request (cron, background), there is no cookie → unknown → no send.

import { cookies } from "next/headers";
import {
  CONSENT_STORAGE_KEY,
  parseAnalyticsConsent,
  type ConsentChoice,
} from "@/lib/analytics";

/** Acting user's analytics consent for this request, or null if unknown. */
export async function readRequestAnalyticsConsent(): Promise<ConsentChoice | null> {
  try {
    const jar = await cookies();
    return parseAnalyticsConsent(jar.get(CONSENT_STORAGE_KEY)?.value);
  } catch {
    return null;
  }
}
