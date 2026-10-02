import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { ONBOARDING_DATE } from "@/lib/relationships";

type DbClient = SupabaseClient<Database>;

/**
 * Idempotently create the connection's onboarding instance (unique on
 * connection_id + kind + scheduled_for sentinel). Uses the caller's session
 * client so RLS membership checks apply — same path as startOnboarding.
 * Returns the instance id, or null if a pack isn't available / insert failed.
 */
export async function ensureOnboardingInstance(
  supabase: DbClient,
  connectionId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("prompt_instances")
    .select("id")
    .eq("connection_id", connectionId)
    .eq("kind", "onboarding")
    .maybeSingle();
  if (existing) return existing.id;

  const { data: conn } = await supabase
    .from("connections")
    .select("type")
    .eq("id", connectionId)
    .single();
  if (!conn) return null;

  // Prefer a type-specific onboarding pack, else a generic one.
  const { data: tmpl } = await supabase
    .from("prompt_templates")
    .select("id, questions, relationship_type")
    .eq("kind", "onboarding")
    .eq("active", true)
    .or(`relationship_type.eq.${conn.type},relationship_type.is.null`)
    .order("relationship_type", { nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!tmpl) return null;

  const { data: created, error } = await supabase
    .from("prompt_instances")
    .upsert(
      {
        connection_id: connectionId,
        kind: "onboarding",
        template_id: tmpl.id,
        questions: tmpl.questions,
        scheduled_for: ONBOARDING_DATE,
        status: "open",
      },
      { onConflict: "connection_id,kind,scheduled_for", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("ensureOnboardingInstance failed", connectionId, error.message);
    return null;
  }
  if (created) return created.id;

  // Race: another member created it between our select and upsert.
  const { data: again } = await supabase
    .from("prompt_instances")
    .select("id")
    .eq("connection_id", connectionId)
    .eq("kind", "onboarding")
    .maybeSingle();
  return again?.id ?? null;
}
