"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildRedactor } from "@/lib/redact";
import { assessSafety } from "@/lib/safetyClassifier";
import { logAudit } from "@/lib/audit";
import { grokChat } from "@/lib/grok";
import {
  blueprintSystemPrompt,
  blueprintUserPrompt,
  MAX_RECENT_FOR_BLUEPRINT,
  parseBlueprint,
  type BlueprintQa,
} from "@/lib/blueprint";
import {
  claimInsightSlot,
  finalizeInsightClaim,
  releaseInsightClaim,
} from "@/lib/insightRateLimit";
import type { PromptQuestion, Json } from "@/lib/database.types";

const BLUEPRINT_GAP_MS = 10 * 60 * 1000; // one generation per connection per 10 minutes

// Generate the AI Relationship Blueprint. AI generation is PREMIUM-gated here
// (defense in depth — the UI also gates). Safety detection runs regardless and
// is never paywalled: a high-severity signal withholds the AI analysis and
// surfaces support instead, logging a safety_event for review.
export async function generateBlueprint(connectionId: string) {
  // Predictable failures redirect back with a message the page renders as a
  // banner — throwing would replace the page with the generic error boundary.
  const back = (code: string): never =>
    redirect(`/connections/${connectionId}/blueprint?error=${code}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/connections/${connectionId}/blueprint`);

  const { data: conn } = await supabase
    .from("connections")
    .select("id, type")
    .eq("id", connectionId)
    .maybeSingle();
  if (!conn) redirect("/connections");

  // --- entitlement gate: Premium covers the connection (either member's
  // plan unlocks the shared Blueprint). No Grok call fires otherwise. ---
  const { data: isPremium } = await supabase.rpc("connection_has_premium", {
    p_conn: connectionId,
  });
  if (!isPremium) back("premium");

  // Need a revealed onboarding instance so both answers are readable.
  const { data: instance } = await supabase
    .from("prompt_instances")
    .select("id, questions, status")
    .eq("connection_id", connectionId)
    .eq("kind", "onboarding")
    .maybeSingle();
  if (!instance || instance.status !== "revealed") back("notready");

  const { data: responses } = await supabase
    .from("prompt_responses")
    .select("user_id, answers")
    .eq("instance_id", instance!.id);
  if (!responses || responses.length < 2) back("notready");

  // Atomic rate limit after readiness: insert a claim row first, then verify
  // we are the only generation inside the gap (insert-then-verify).
  const admin = createAdminClient();
  const slot = await claimInsightSlot(
    admin,
    connectionId,
    "blueprint",
    BLUEPRINT_GAP_MS,
  );
  if (!slot.ok) {
    back("ratelimit");
  }
  // slot.ok is true here; redirect()/back is typed loosely under tsc.
  const claimId = slot.ok ? slot.claim.id : "";
  if (!claimId) back("ratelimit");

  // Sorted so which participant is P1 is stable across regenerations.
  const ids = responses!.map((r) => r.user_id).sort();
  const { data: profiles } = await supabase
    .from("partner_profiles")
    .select("id, display_name")
    .in("id", ids);
  const nameFor = (uid: string) =>
    profiles?.find((p) => p.id === uid)?.display_name ?? "";

  const [m1, m2] = ids;
  const redactor = buildRedactor([nameFor(m1), nameFor(m2)]);
  const questions = instance!.questions as PromptQuestion[];
  const a1 = (responses!.find((r) => r.user_id === m1)?.answers ?? {}) as Record<string, string>;
  const a2 = (responses!.find((r) => r.user_id === m2)?.answers ?? {}) as Record<string, string>;

  // Recent revealed dailies (both answers visible under RLS by definition of
  // "revealed"), so the Blueprint reflects the present, not just the start.
  const { data: recentInstances } = await supabase
    .from("prompt_instances")
    .select("id, questions, revealed_at")
    .eq("connection_id", connectionId)
    .eq("kind", "daily")
    .eq("status", "revealed")
    .order("revealed_at", { ascending: false })
    .limit(MAX_RECENT_FOR_BLUEPRINT);
  const recentIds = (recentInstances ?? []).map((i) => i.id);
  const { data: recentResponses } = recentIds.length
    ? await supabase
        .from("prompt_responses")
        .select("instance_id, user_id, answers")
        .in("instance_id", recentIds)
    : { data: [] as { instance_id: string; user_id: string; answers: unknown }[] };
  const recentRaw: string[] = [];
  const recentQa: BlueprintQa[] = [];
  for (const inst of [...(recentInstances ?? [])].reverse()) {
    const r1 = (recentResponses ?? []).find((r) => r.instance_id === inst.id && r.user_id === m1);
    const r2 = (recentResponses ?? []).find((r) => r.instance_id === inst.id && r.user_id === m2);
    if (!r1 || !r2) continue;
    const b1 = (r1.answers ?? {}) as Record<string, string>;
    const b2 = (r2.answers ?? {}) as Record<string, string>;
    for (const q of inst.questions as PromptQuestion[]) {
      recentRaw.push(`${b1[q.id] ?? ""} ${b2[q.id] ?? ""}`);
      recentQa.push({
        question: q.text,
        p1: redactor.redact(b1[q.id] ?? ""),
        p2: redactor.redact(b2[q.id] ?? ""),
        date: inst.revealed_at ? inst.revealed_at.slice(0, 10) : null,
      });
    }
  }

  // Safety assessment: regex fast path runs on the RAW text; the model-backed
  // classifier (which catches paraphrase) sees only redacted text and can
  // raise severity but never lower it. Model failure degrades to regex-only.
  const rawAll = [
    ...questions.map((q) => `${a1[q.id] ?? ""} ${a2[q.id] ?? ""}`),
    ...recentRaw,
  ].join("\n");
  const signal = await assessSafety(rawAll, redactor.redact);

  // High severity → withhold AI analysis, surface support, log for review.
  if (signal.severity === "high") {
    await admin.from("safety_events").insert({
      user_id: user.id,
      category: signal.categories[0] ?? "abuse",
      surfaced_resources: { categories: signal.categories } as Json,
    });
    await finalizeInsightClaim(admin, claimId, {
      summary: "Support resources",
      payload: { safety: true, categories: signal.categories } as Json,
      safety_flags: {
        severity: "high",
        categories: signal.categories,
        reviewed: false,
      } as Json,
    });
    await logAudit(user.id, "blueprint.withheld_safety", connectionId);
    revalidatePath(`/connections/${connectionId}/blueprint`);
    redirect(`/connections/${connectionId}/blueprint`);
  }

  const qa = questions.map((q) => ({
    question: q.text,
    p1: redactor.redact(a1[q.id] ?? ""),
    p2: redactor.redact(a2[q.id] ?? ""),
  }));

  let bp;
  try {
    const content = await grokChat(
      [blueprintSystemPrompt(), blueprintUserPrompt(conn!.type, qa, recentQa)],
      { json: true },
    );
    bp = parseBlueprint(content);
  } catch {
    await releaseInsightClaim(admin, claimId);
    back("ai");
    return; // unreachable — for control-flow analysis
  }

  await finalizeInsightClaim(admin, claimId, {
    summary: bp.reflection.slice(0, 200),
    payload: bp as unknown as Json,
    model: process.env.XAI_MODEL ?? "grok-4",
    safety_flags: {
      severity: signal.severity,
      categories: signal.categories,
    } as Json,
  });
  await logAudit(user.id, "blueprint.generate", connectionId);

  revalidatePath(`/connections/${connectionId}/blueprint`);
  revalidatePath(`/connections/${connectionId}`);
  // Land on a clean URL (drops any stale ?error= from a previous attempt).
  redirect(`/connections/${connectionId}/blueprint`);
}
