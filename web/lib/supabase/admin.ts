import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Service-role client — BYPASSES RLS. Server-only. Use for trusted writes the
// user cannot perform under RLS: Stripe webhook → subscriptions, Grok → insights
// / safety_events. Never import this into a client component.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
