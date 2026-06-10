// Best-effort audit trail for sensitive actions (AI generation, data export,
// account deletion, connection lifecycle). Service-role write — users can read
// their own rows under RLS but never write. Auditing must never block or fail
// the user's action, hence the swallow-all catch.

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

export async function logAudit(
  userId: string | null,
  action: string,
  target?: string,
  meta?: Json,
): Promise<void> {
  try {
    await createAdminClient().from("audit_log").insert({
      user_id: userId,
      action,
      target: target ?? null,
      meta: meta ?? {},
    });
  } catch {
    /* never block the user's action on audit logging */
  }
}
