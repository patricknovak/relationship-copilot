"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Shared goals ("things we're trying"). All writes go through the user's
// session client, so RLS (members only) and the DB trigger (frozen
// ownership columns) are the authority. Predictable failures land back on
// the hub as a notice rather than a crash page.

const MAX_OPEN_GOALS = 20;
const MAX_LEN = 200;

export async function addGoal(connectionId: string, formData: FormData) {
  const body = String(formData.get("body") || "").trim().slice(0, MAX_LEN);
  const back = (code: string): never =>
    redirect(`/connections/${connectionId}?notice=${code}#goals`);
  if (!body) back("goal-empty");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/connections/${connectionId}`);

  const { count } = await supabase
    .from("connection_goals")
    .select("id", { count: "exact", head: true })
    .eq("connection_id", connectionId)
    .is("done_at", null);
  if ((count ?? 0) >= MAX_OPEN_GOALS) back("goal-full");

  const { error } = await supabase
    .from("connection_goals")
    .insert({ connection_id: connectionId, created_by: user.id, body });
  if (error) back("goal-failed");

  revalidatePath(`/connections/${connectionId}`);
  redirect(`/connections/${connectionId}#goals`);
}

export async function toggleGoal(connectionId: string, goalId: string, done: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/connections/${connectionId}`);

  await supabase
    .from("connection_goals")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", goalId)
    .eq("connection_id", connectionId);

  revalidatePath(`/connections/${connectionId}`);
  redirect(`/connections/${connectionId}#goals`);
}

export async function removeGoal(connectionId: string, goalId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/connections/${connectionId}`);

  await supabase
    .from("connection_goals")
    .delete()
    .eq("id", goalId)
    .eq("connection_id", connectionId);

  revalidatePath(`/connections/${connectionId}`);
  redirect(`/connections/${connectionId}#goals`);
}
