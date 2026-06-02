"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildRedactor } from "@/lib/redact";
import { detectSafetySignals } from "@/lib/safety";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: conn } = await supabase
    .from("connections")
    .select("id, type")
    .eq("id", connectionId)
    .maybeSingle();
  if (!conn) throw new Error("Connection not found.");

  // --- entitlement gate (premium only). No Grok call fires for free users. ---
  const { data: isPremium } = await supabase.rpc("has_premium", { uid: user.id });
  if (!isPremium) throw new Error("PREMIUM_REQUIRED");

  // Need a revealed onboarding instance so both answers are readable.
  const { data: instance } = await supabase
    .from("prompt_instances")
    .select("id, questions, status")
    .eq("connection_id", connectionId)
    .eq("kind", "onboarding")
    .maybeSingle();
  if (!instance || instance.status !== "revealed") {
    throw new Error("Finish the 20 questions together first.");
  }

  const { data: responses } = await supabase
    .from("prompt_responses")
    .select("user_id, answers")
    .eq("instance_id", instance.id);
  if (!responses || responses.length < 2) {
    throw new Error("Both people's answers are needed.");
  }

  const ids = responses.map((r) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids);
  const nameFor = (uid: string) =>
    profiles?.find((p) => p.id === uid)?.display_name ?? "";

  const [m1, m2] = ids;
  const redactor = buildRedactor([nameFor(m1), nameFor(m2)]);
  const questions = instance.questions as PromptQuestion[];
  const a1 = (responses.find((r) => r.user_id === m1)?.answers ?? {}) as Record<string, string>;
  const a2 = (responses.find((r) => r.user_id === m2)?.answers ?? {}) as Record<string, string>;

  // Safety detection on the RAW (pre-redaction) text.
  const rawAll = questions.map((q) => `${a1[q.id] ?? ""} ${a2[q.id] ?? ""}`).join("\n");
  const signal = detectSafetySignals(rawAll);

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
    revalidatePath(`/connections/${connectionId}/blueprint`);
    return;
  }

  const qa = questions.map((q) => ({
    question: q.text,
    p1: redactor.redact(a1[q.id] ?? ""),
    p2: redactor.redact(a2[q.id] ?? ""),
  }));

  const content = await grokChat(
    [blueprintSystemPrompt(), blueprintUserPrompt(conn.type, qa)],
    { json: true },
  );
  const bp = parseBlueprint(content);

  await admin.from("relationship_insights").insert({
    connection_id: connectionId,
    kind: "blueprint",
    audience: "shared",
    summary: bp.reflection.slice(0, 200),
    payload: bp as unknown as Json,
    model: process.env.XAI_MODEL ?? "grok-4",
    safety_flags: { severity: signal.severity, categories: signal.categories } as Json,
  });

  revalidatePath(`/connections/${connectionId}/blueprint`);
  revalidatePath(`/connections/${connectionId}`);
}
