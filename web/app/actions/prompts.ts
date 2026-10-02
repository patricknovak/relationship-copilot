"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectSafetySignals } from "@/lib/safety";
import {
  scheduleFirstMutualRevealCompleted,
  shouldTrackFirstMutualReveal,
} from "@/lib/ga4";
import type { PromptQuestion, Json } from "@/lib/database.types";
import { ensureOnboardingInstance } from "@/lib/onboarding";

// Always-free, plan-independent: log a safety event when free-text content
// raises a high-severity signal, so support can be surfaced regardless of tier.
async function logSafety(userId: string, text: string) {
  const signal = detectSafetySignals(text);
  if (signal.severity !== "high") return;
  try {
    await createAdminClient()
      .from("safety_events")
      .insert({
        user_id: userId,
        category: signal.categories[0] ?? "abuse",
        surfaced_resources: { categories: signal.categories } as Json,
      });
  } catch {
    /* never block the user's action on safety logging */
  }
}

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
    redirect(`/connections/${connectionId}?notice=waiting`);
  }

  const instanceId = await ensureOnboardingInstance(supabase, connectionId);
  if (!instanceId) {
    redirect(`/connections/${connectionId}?notice=nopack`);
  }

  redirect(`/connections/${connectionId}/onboarding`);
}

// Start an elective quiz or challenge for a connection from a template,
// snapshotting its questions into a new instance. Multiple are allowed.
export async function startElective(connectionId: string, templateId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/connections/${connectionId}/explore`);

  // Both people must be in before an activity starts — otherwise the first
  // answer would be the only one the reveal ever waits for.
  const { count: joined } = await supabase
    .from("connection_members")
    .select("user_id", { count: "exact", head: true })
    .eq("connection_id", connectionId)
    .not("joined_at", "is", null);
  if ((joined ?? 0) < 2) {
    redirect(`/connections/${connectionId}/explore?notice=waiting`);
  }

  const { data: tmpl } = await supabase
    .from("prompt_templates")
    .select("id, kind, questions")
    .eq("id", templateId)
    .eq("active", true)
    .maybeSingle();
  if (!tmpl || (tmpl.kind !== "quiz" && tmpl.kind !== "challenge")) {
    redirect(`/connections/${connectionId}/explore?notice=unavailable`);
  }

  const { data: created, error } = await supabase
    .from("prompt_instances")
    .insert({
      connection_id: connectionId,
      template_id: tmpl!.id,
      kind: tmpl!.kind,
      questions: tmpl!.questions,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !created) {
    redirect(`/connections/${connectionId}/explore?notice=unavailable`);
  }

  redirect(`/connections/${connectionId}/prompts/${created!.id}`);
}

const MAX_ANSWER_LENGTH = 8000;

// Submit (or, while still open, re-submit) the current user's answers to an
// instance. The reveal trigger flips the instance once everyone has answered.
// Returns friendly errors instead of throwing — this form holds up to 20
// hand-written answers, and a crash page would destroy them.
export async function submitResponse(input: {
  instanceId: string;
  connectionId: string;
  answers: Record<string, string>;
}): Promise<{ error?: string; revealed?: boolean }> {
  const { instanceId, connectionId } = input;
  if (!instanceId || !connectionId) {
    return { error: "This question is no longer available." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/connections/${connectionId}`);

  const { data: instance } = await supabase
    .from("prompt_instances")
    .select("questions, kind, status")
    .eq("id", instanceId)
    .single();
  if (!instance) return { error: "This question is no longer available." };
  if (instance.status !== "open") {
    return {
      error:
        "This one has already revealed — answers are locked now. Refresh to see them side by side.",
    };
  }

  // Trust boundary: accept only known question ids, as trimmed strings.
  const questions = instance.questions as PromptQuestion[];
  const answers: Record<string, string> = {};
  for (const q of questions) {
    const v = input.answers?.[q.id];
    if (typeof v === "string") answers[q.id] = v.trim().slice(0, MAX_ANSWER_LENGTH);
  }
  const blank = questions.filter((q) => !answers[q.id]);
  if (blank.length > 0) {
    return {
      error:
        blank.length === questions.length
          ? "Write your answers first — submitting locks them in."
          : `Almost there — ${blank.length} question${blank.length === 1 ? " still needs" : "s still need"} an answer.`,
    };
  }

  const { error } = await supabase.from("prompt_responses").upsert(
    { instance_id: instanceId, user_id: user.id, answers },
    { onConflict: "instance_id,user_id" },
  );
  if (error) {
    // The likeliest cause: the partner finished while this edit was in
    // flight, so the row is frozen by the reveal (RLS update policy).
    return {
      error:
        "Couldn't save — if the reveal just happened, your earlier answer is already locked in. Refresh to check.",
    };
  }

  await logSafety(user.id, Object.values(answers).join(" "));

  // If onboarding just fully revealed, mark the connection active.
  let revealed = false;
  const { data: refreshed } = await supabase
    .from("prompt_instances")
    .select("status")
    .eq("id", instanceId)
    .single();
  revealed = refreshed?.status === "revealed";
  if (instance.kind === "onboarding" && revealed) {
    await supabase
      .from("connections")
      .update({ status: "active", onboarding_done: true })
      .eq("id", connectionId);
  }

  // North-star GA4: once-only claim in DB (survives concurrent final submits),
  // then schedule MP send via after() so serverless does not drop it.
  // Anonymous payload — no user/connection IDs. See docs/ga4-first-mutual-reveal.md.
  // Rollout: apply migration 0017 before this code ships — if the RPC is
  // missing, claimed stays null and the event silently does not fire.
  if (revealed) {
    const { data: claimed, error: claimError } = await supabase.rpc(
      "claim_first_mutual_reveal_ga4",
      { p_connection_id: connectionId },
    );
    if (claimError) {
      // No connection/user IDs — surfaces a missing 0017 migration in Vercel logs.
      console.error(
        "[ga4] claim_first_mutual_reveal_ga4 failed",
        claimError.message,
      );
    } else if (shouldTrackFirstMutualReveal(claimed === true)) {
      scheduleFirstMutualRevealCompleted();
    }
  }

  revalidatePath(`/connections/${connectionId}/onboarding`);
  revalidatePath(`/connections/${connectionId}/prompts/${instanceId}`);
  revalidatePath(`/connections/${connectionId}`);
  return { revealed };
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
  if (error || !data) {
    redirect(`/connections/${connectionId}?notice=nodaily`);
  }

  redirect(`/connections/${connectionId}/prompts/${data}`);
}

export async function postDiscussion(input: {
  instanceId: string;
  connectionId: string;
  body: string;
}): Promise<{ error?: string }> {
  const { instanceId, connectionId } = input;
  const body = (input.body ?? "").trim().slice(0, MAX_ANSWER_LENGTH);
  if (!instanceId || !body) return {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("prompt_discussions")
    .insert({ instance_id: instanceId, user_id: user.id, body });
  if (error) {
    return { error: "Couldn't send that — give it another try." };
  }

  revalidatePath(`/connections/${connectionId}/onboarding`);
  revalidatePath(`/connections/${connectionId}/prompts/${instanceId}`);
  return {};
}
