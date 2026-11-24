"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { logAudit } from "@/lib/audit";
import { cancelFailureKind } from "@/lib/stripeErrors";

// Subscription statuses with nothing left to cancel.
const ENDED_STATUSES = new Set(["canceled", "incomplete_expired"]);

// Account deletion, "redact, partner keeps theirs" model:
//   - the user's own content (profile, answers, discussion posts, memberships,
//     safety events, subscription) is deleted via the auth-user cascade;
//   - shared AI insights are removed (they were derived from the user's answers);
//   - connections with a remaining member are archived for them, with their
//     own answers intact; connections with no one left are deleted outright.
// Returns a message instead of throwing for failures the person can act on:
// in production a thrown server-action error reaches the browser with its
// message stripped, so the form could only say "something went wrong".
export async function deleteAccount(
  formData: FormData,
): Promise<{ error: string } | never> {
  if (String(formData.get("confirm") || "") !== "DELETE") {
    return { error: "Type DELETE to confirm account deletion." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Stop billing first, before anything is deleted. If Stripe will not
  // confirm the cancellation, deleting anyway would leave a subscription
  // charging someone who no longer has an account to cancel it from, so stop
  // here with nothing removed and let them retry or cancel in the portal.
  // A subscription Stripe no longer knows, or one already ended, is fine.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (sub?.stripe_subscription_id && !ENDED_STATUSES.has(sub.status)) {
    try {
      await getStripe().subscriptions.cancel(sub.stripe_subscription_id);
    } catch (err) {
      if (cancelFailureKind(err) === "failed") {
        console.error("account deletion: stripe cancel failed", err);
        return {
          error:
            "We couldn't cancel your Premium subscription just now, so nothing was deleted. Try again in a minute, or cancel it under Manage billing first and then delete your account.",
        };
      }
    }
  }

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

  // Logged before deletion; the FK sets user_id to null so the trail survives.
  await logAudit(user.id, "account.delete");

  // Deleting the auth user cascades: profile → responses, discussions,
  // memberships, safety events, subscription.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("account deletion: deleteUser failed", error.message);
    return {
      error:
        "We couldn't finish deleting your account. Try again in a minute, or email privacy@relationshipcopilot.com and we'll complete it.",
    };
  }

  await supabase.auth.signOut();
  redirect("/");
}
