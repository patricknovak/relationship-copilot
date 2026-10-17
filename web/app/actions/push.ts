"use server";

import { createClient } from "@/lib/supabase/server";
import { parsePushSubscription } from "@/lib/webPush";
import { logAudit } from "@/lib/audit";

// Save this browser's push subscription for the signed-in user. The endpoint
// must belong to a known push service (SSRF allowlist in lib/webPush.ts); the
// RPC (migration 0034) writes only the caller's own row.
export async function savePushSubscription(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const sub = parsePushSubscription(raw);
  if (!sub) return { ok: false, error: "This browser's push service isn't supported." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in again to turn on notifications." };

  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.p256dh,
    p_auth: sub.auth,
  });
  if (error) return { ok: false, error: "Couldn't save that just now. Try again in a moment." };
  await logAudit(user.id, "push.subscribe");
  return { ok: true };
}

// Forget this browser's subscription (turning it off, or signing out).
export async function deletePushSubscription(endpoint: unknown): Promise<{ ok: boolean }> {
  if (typeof endpoint !== "string" || endpoint.length > 1024) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.rpc("delete_push_subscription", { p_endpoint: endpoint });
  return { ok: !error };
}
