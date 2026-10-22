import type { SupabaseClient } from "@supabase/supabase-js";
import { postAuthPath } from "@/lib/postAuthRedirect";

/** Load profile + memberships and return the post-auth path (no explicit next). */
export async function resolvePostAuthDestination(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  const { data: memberships } = await supabase
    .from("connection_members")
    .select("connection_id, user_id")
    .eq("user_id", userId)
    .not("joined_at", "is", null);

  const myConnIds = Array.from(
    new Set((memberships ?? []).map((m) => m.connection_id)),
  );

  const partnerByConn = new Set<string>();
  if (myConnIds.length) {
    const { data: others } = await supabase
      .from("connection_members")
      .select("connection_id, user_id")
      .in("connection_id", myConnIds)
      .neq("user_id", userId)
      .not("joined_at", "is", null);
    for (const row of others ?? []) partnerByConn.add(row.connection_id);
  }

  return postAuthPath({
    profile: profile ?? null,
    connections: myConnIds.map((id) => ({
      id,
      hasPartner: partnerByConn.has(id),
    })),
  });
}
