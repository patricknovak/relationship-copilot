"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { logAudit } from "@/lib/audit";

// Account deletion, "redact, partner keeps theirs" model:
//   - the user's own content (profile, answers, discussion posts, memberships,
//     safety events, subscription) is deleted via the auth-user cascade;
//   - shared AI insights are removed (they were derived from the user's answers);
//   - connections with a remaining member are archived for them, with their
//     own answers intact; connections with no one left are deleted outright.
export async function deleteAccount(formData: FormData) {
  if (String(formData.get("confirm") || "") !== "DELETE") {
    throw new Error('Type DELETE to confirm account deletion.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: memberships } = await admin
    .from("connection_members")
    .select("connection_id")
    .eq("user_id", user.id);
  const connIds = (memberships ?? []).map((m) => m.connection_id);

  if (connIds.length) {
    // Shared insights (Blueprints, digests) are derived from this user's
    // answers — remove them. Per-user insights for the partner survive.
    await admin
      .from("relationship_insights")
      .delete()
      .in("connection_id", connIds)
      .eq("audience", "shared");

    // Split connections by whether anyone else is in them.
    const { data: others } = await admin
      .from("connection_members")
      .select("connection_id")
      .in("connection_id", connIds)
      .neq("user_id", user.id);
    const withPartner = new Set((others ?? []).map((o) => o.connection_id));

    const orphaned = connIds.filter((id) => !withPartner.has(id));
    if (orphaned.length) {
      await admin.from("connections").delete().in("id", orphaned);
    }
    const shared = connIds.filter((id) => withPartner.has(id));
    if (shared.length) {
      await admin
        .from("connections")
        .update({ status: "archived" })
        .in("id", shared);
    }
  }

  // Best-effort: stop billing. Failure here must not strand the deletion.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (sub?.stripe_subscription_id) {
    try {
      await getStripe().subscriptions.cancel(sub.stripe_subscription_id);
    } catch {
      /* subscription may already be canceled or Stripe unreachable */
    }
  }

  // Logged before deletion; the FK sets user_id to null so the trail survives.
  await logAudit(user.id, "account.delete");

  // Deleting the auth user cascades: profile → responses, discussions,
  // memberships, safety events, subscription.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    throw new Error(`Could not delete the account: ${error.message}`);
  }

  await supabase.auth.signOut();
  redirect("/");
}
