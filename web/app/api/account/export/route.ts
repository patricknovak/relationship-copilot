import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Data portability: download everything the account contains as JSON. All
// reads go through the user's own session client, so RLS bounds the export to
// exactly what the user can already see — notably, a partner's un-revealed
// answers can never appear here.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const { data: memberships } = await supabase
    .from("connection_members")
    .select("*")
    .eq("user_id", user.id);
  const connIds = (memberships ?? []).map((m) => m.connection_id);

  const { data: connections } = connIds.length
    ? await supabase
        .from("connections")
        .select("id, type, sub_type, status, life_stage, start_date, created_at")
        .in("id", connIds)
    : { data: [] };

  const { data: responses } = await supabase
    .from("prompt_responses")
    .select("*")
    .eq("user_id", user.id);

  const { data: discussions } = await supabase
    .from("prompt_discussions")
    .select("*")
    .eq("user_id", user.id);

  const { data: insights } = connIds.length
    ? await supabase
        .from("relationship_insights")
        .select("*")
        .in("connection_id", connIds)
    : { data: [] };

  const { data: safetyEvents } = await supabase
    .from("safety_events")
    .select("*")
    .eq("user_id", user.id);

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  await logAudit(user.id, "account.export");

  const payload = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    profile,
    connections,
    memberships,
    prompt_responses: responses,
    discussions,
    insights,
    safety_events: safetyEvents,
    subscription,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition":
        'attachment; filename="relationship-copilot-export.json"',
    },
  });
}
