"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ONBOARDING_DATE } from "@/lib/relationships";
import type { PromptQuestion } from "@/lib/database.types";

// Ensure the connection's onboarding instance exists (idempotent via the
// sentinel-date unique constraint), then go to the onboarding flow. Requires
// both members to have joined so the reveal can't trigger prematurely.
export async function startOnboarding(connectionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { count: joined } = await supabase
    .from("connection_members")
    .select("user_id", { count: "exact", head: true })
    .eq("connection_id", connectionId)
    .not("joined_at", "is", null);
  if ((joined ?? 0) < 2) {
    throw new Error("Both people need to join before starting the questions.");
  }

  const { data: existing } = await supabase
    .from("prompt_instances")
    .select("id")
    .eq("connection_id", connectionId)
    .eq("kind", "onboarding")
    .maybeSingle();

  if (!existing) {
    const { data: conn } = await supabase
      .from("connections")
      .select("type")
      .eq("id", connectionId)
      .single();
    if (!conn) throw new Error("Connection not found.");

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
    if (!tmpl) throw new Error("No onboarding questions available yet.");

    await supabase.from("prompt_instances").upsert(
      {
        connection_id: connectionId,
        kind: "onboarding",
        template_id: tmpl.id,
        questions: tmpl.questions,
        scheduled_for: ONBOARDING_DATE,
        status: "open",
      },
      { onConflict: "connection_id,kind,scheduled_for", ignoreDuplicates: true },
    );
  }

  redirect(`/connections/${connectionId}/onboarding`);
}

// Submit (or, while still open, re-submit) the current user's answers to an
// instance. The reveal trigger flips the instance once everyone has answered.
export async function submitResponse(formData: FormData) {
  const instanceId = String(formData.get("instance_id") || "");
  const connectionId = String(formData.get("connection_id") || "");
  if (!instanceId || !connectionId) throw new Error("Missing instance.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: instance } = await supabase
    .from("prompt_instances")
    .select("questions, kind")
    .eq("id", instanceId)
    .single();
  if (!instance) throw new Error("Instance not found.");

  const answers: Record<string, string> = {};
  for (const q of instance.questions as PromptQuestion[]) {
    const v = formData.get(`q_${q.id}`);
    if (v != null) answers[q.id] = String(v);
  }

  const { error } = await supabase.from("prompt_responses").upsert(
    { instance_id: instanceId, user_id: user.id, answers },
    { onConflict: "instance_id,user_id" },
  );
  if (error) throw new Error(error.message);

  // If onboarding just fully revealed, mark the connection active.
  if (instance.kind === "onboarding") {
    const { data: refreshed } = await supabase
      .from("prompt_instances")
      .select("status")
      .eq("id", instanceId)
      .single();
    if (refreshed?.status === "revealed") {
      await supabase
        .from("connections")
        .update({ status: "active", onboarding_done: true })
        .eq("id", connectionId);
    }
  }

  revalidatePath(`/connections/${connectionId}/onboarding`);
  revalidatePath(`/connections/${connectionId}`);
}

// Pull (or create) today's daily question for a connection, then open it.
export async function ensureDaily(connectionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("ensure_daily_prompt", {
    p_conn: connectionId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No daily question is available yet.");

  redirect(`/connections/${connectionId}/prompts/${data}`);
}

export async function postDiscussion(formData: FormData) {
  const instanceId = String(formData.get("instance_id") || "");
  const connectionId = String(formData.get("connection_id") || "");
  const body = String(formData.get("body") || "").trim();
  if (!instanceId || !body) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("prompt_discussions")
    .insert({ instance_id: instanceId, user_id: user.id, body });
  if (error) throw new Error(error.message);

  revalidatePath(`/connections/${connectionId}/onboarding`);
}
