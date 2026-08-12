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
  parseBlueprint,
} from "@/lib/blueprint";
import type { PromptQuestion, Json } from "@/lib/database.types";

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

  // --- entitlement gate (premium only). No Grok call fires for free users. ---
  const { data: isPremium } = await supabase.rpc("has_premium", { uid: user.id });
  if (!isPremium) back("premium");

  // Rate limit: one generation per connection per 10 minutes (cost control —
  // each run is a model call). DB-backed so it holds across serverless instances.
  const { data: recent } = await supabase
    .from("relationship_insights")
    .select("generated_at")
    .eq("connection_id", connectionId)
    .eq("kind", "blueprint")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (
    recent &&
    Date.now() - new Date(recent.generated_at).getTime() < 10 * 60 * 1000
  ) {
    back("ratelimit");
  }

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

  // Sorted so which participant is P1 is stable across regenerations.
  const ids = responses!.map((r) => r.user_id).sort();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids);
  const nameFor = (uid: string) =>
    profiles?.find((p) => p.id === uid)?.display_name ?? "";

  const [m1, m2] = ids;
  const redactor = buildRedactor([nameFor(m1), nameFor(m2)]);
  const questions = instance!.questions as PromptQuestion[];
  const a1 = (responses!.find((r) => r.user_id === m1)?.answers ?? {}) as Record<string, string>;
  const a2 = (responses!.find((r) => r.user_id === m2)?.answers ?? {}) as Record<string, string>;

  // Safety assessment: regex fast path runs on the RAW text; the model-backed
  // classifier (which catches paraphrase) sees only redacted text and can
  // raise severity but never lower it. Model failure degrades to regex-only.
  const rawAll = questions.map((q) => `${a1[q.id] ?? ""} ${a2[q.id] ?? ""}`).join("\n");
  const signal = await assessSafety(rawAll, redactor.redact);

  const admin = createAdminClient();

  // High severity → withhold AI analysis, surface support, log for review.
  if (signal.severity === "high") {
    await admin.from("safety_events").insert({
      user_id: user.id,
      category: signal.categories[0] ?? "abuse",
      surfaced_resources: { categories: signal.categories } as Json,
    });
    await admin.from("relationship_insights").insert({
      connection_id: connectionId,
      kind: "blueprint",
      audience: "shared",
      summary: "Support resources",
      payload: { safety: true, categories: signal.categories } as Json,
      safety_flags: { severity: "high", categories: signal.categories, reviewed: false } as Json,
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
      [blueprintSystemPrompt(), blueprintUserPrompt(conn!.type, qa)],
      { json: true },
    );
    bp = parseBlueprint(content);
  } catch {
    back("ai");
    return; // unreachable — for control-flow analysis
  }

  await admin.from("relationship_insights").insert({
    connection_id: connectionId,
    kind: "blueprint",
    audience: "shared",
    summary: bp.reflection.slice(0, 200),
    payload: bp as unknown as Json,
    model: process.env.XAI_MODEL ?? "grok-4",
    safety_flags: { severity: signal.severity, categories: signal.categories } as Json,
  });
  await logAudit(user.id, "blueprint.generate", connectionId);

  revalidatePath(`/connections/${connectionId}/blueprint`);
  revalidatePath(`/connections/${connectionId}`);
  // Land on a clean URL (drops any stale ?error= from a previous attempt).
  redirect(`/connections/${connectionId}/blueprint`);
}
