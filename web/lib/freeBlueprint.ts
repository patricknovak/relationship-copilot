// One free AI Blueprint per connection (migration 0043), and the single rule
// for what the Blueprint surfaces may offer. The page, the server action, the
// hub card and the pricing page all ask the same questions here so they can
// never disagree about whether something is on sale.
//
// Every database helper degrades to "unsupported" when the table is missing
// (migration not yet applied in an environment), which leaves today's
// behaviour: Premium-only Blueprints, no free offer shown anywhere.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type FreeBlueprintState = "available" | "used" | "unsupported";

/** Read under the member's session (RLS: members see their connection's row). */
export async function freeBlueprintState(
  supabase: Client,
  connectionId: string,
): Promise<FreeBlueprintState> {
  const { data, error } = await supabase
    .from("free_blueprint_claims")
    .select("connection_id")
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (error) return "unsupported";
  return data ? "used" : "available";
}

/** Whether the free Blueprint exists in this environment at all (public pages). */
export async function freeBlueprintSupported(supabase: Client): Promise<boolean> {
  const { error } = await supabase
    .from("free_blueprint_claims")
    .select("connection_id", { count: "exact", head: true })
    .limit(1);
  return !error;
}

export type ClaimResult = "claimed" | "used" | "unsupported";

/**
 * Claim the connection's free Blueprint with the service role. Call only
 * after the caller has proved membership (an RLS read of the connection) and
 * that the first set is revealed. The primary key makes it once-only even
 * when both members click at the same moment.
 */
export async function claimFreeBlueprint(
  admin: Client,
  connectionId: string,
  userId: string,
): Promise<ClaimResult> {
  const { error } = await admin
    .from("free_blueprint_claims")
    .insert({ connection_id: connectionId, claimed_by: userId });
  if (!error) return "claimed";
  if (error.code === "23505") return "used";
  return "unsupported";
}

/** Give the free Blueprint back when generation did not produce one. */
export async function releaseFreeBlueprint(admin: Client, connectionId: string): Promise<void> {
  await admin.from("free_blueprint_claims").delete().eq("connection_id", connectionId);
}

export type BlueprintOffer =
  /** Premium connection, AI on: generate and regenerate. */
  | "premium"
  /** Not Premium, free Blueprint unused, first set revealed: generate once. */
  | "free"
  /** Not Premium, free Blueprint unused, first set not revealed yet. */
  | "free-later"
  /** Not Premium and the free one is used (or unsupported): see Premium. */
  | "upsell"
  /** The AI provider is not switched on here: nothing to generate or sell. */
  | "ai-off";

/** What the Blueprint page and hub card offer when no Blueprint exists yet. */
export function blueprintOffer(input: {
  isPremium: boolean;
  aiOn: boolean;
  revealed: boolean;
  free: FreeBlueprintState;
}): BlueprintOffer {
  if (!input.aiOn) return "ai-off";
  if (input.isPremium) return "premium";
  if (input.free !== "available") return "upsell";
  return input.revealed ? "free" : "free-later";
}
