"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { runWeeklyDigest } from "@/lib/weeklyDigest";

// "Generate weekly digest" button. The work lives in lib/weeklyDigest.ts,
// shared with generate-on-visit; this maps its outcome to where the person
// lands. Predictable failures come back to the connection page as a banner
// (?notice=…) instead of the generic crash boundary.
export async function generateWeeklyDigest(connectionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/connections/${connectionId}`);

  const outcome = await runWeeklyDigest(supabase, user!.id, connectionId, "manual");
  switch (outcome) {
    case "inactive":
      redirect("/connections");
    case "premium":
    case "empty":
    case "solo":
    case "gap":
    case "ai":
      redirect(`/connections/${connectionId}?notice=digest-${outcome}`);
    case "ok":
    case "withheld":
      revalidatePath(`/connections/${connectionId}`);
      // Land on a clean URL (drops any stale ?notice= from a previous attempt).
      redirect(`/connections/${connectionId}`);
  }
}
