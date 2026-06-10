"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildRedactor } from "@/lib/redact";
import { assessSafety } from "@/lib/safetyClassifier";
import { logAudit } from "@/lib/audit";
import { grokChat } from "@/lib/grok";
import {
  digestSystemPrompt,
  digestUserPrompt,
  parseDigest,
  type DigestItem,
} from "@/lib/digest";
import type { PromptQuestion, Json } from "@/lib/database.types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_GAP_MS = 6 * 24 * 60 * 60 * 1000; // one digest per ~week
const MAX_ITEMS = 24; // cap prompt size

// Weekly AI digest of the last 7 days of revealed answers. Same contract as
// the Blueprint: premium-gated generation, safety assessment first (high
// severity withholds output and surfaces support), redaction before anything
// reaches the model. Reads go through the user's session client, so the
// reveal gate in RLS bounds exactly what the digest can see.
export async function generateWeeklyDigest(connectionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: conn } = await supabase
    .from("connections")
    .select("id, type, status")
    .eq("id", connectionId)
    .maybeSingle();
  if (!conn || conn.status !== "active") throw new Error("Connection not found.");

  const { data: isPremium } = await supabase.rpc("has_premium", { uid: user.id });
  if (!isPremium) throw new Error("PREMIUM_REQUIRED");

  const { data: lastDigest } = await supabase
    .from("relationship_insights")
    .select("generated_at")
    .eq("connection_id", connectionId)
    .eq("kind", "weekly_digest")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (
    lastDigest &&
    Date.now() - new Date(lastDigest.generated_at).getTime() < MIN_GAP_MS
  ) {
    throw new Error(
      "This week's digest already exists — a new one unlocks next week.",
    );
  }

  // Last week's revealed activity (daily questions, quizzes, challenges).
  const since = new Date(Date.now() - WEEK_MS).toISOString();
  const { data: instances } = await supabase
    .from("prompt_instances")
    .select("id, kind, questions, revealed_at, template_id")
    .eq("connection_id", connectionId)
    .eq("status", "revealed")
    .gte("revealed_at", since)
    .order("revealed_at", { ascending: true });
  if (!instances || instances.length === 0) {
    throw new Error(
      "Nothing to digest yet — answer a few daily questions together this week first.",
    );
  }

  const instanceIds = instances.map((i) => i.id);
  const { data: responses } = await supabase
    .from("prompt_responses")
    .select("instance_id, user_id, answers")
    .in("instance_id", instanceIds);

  const { data: members } = await supabase
    .from("connection_members")
    .select("user_id")
    .eq("connection_id", connectionId)
    .not("joined_at", "is", null);
  const ids = (members ?? []).map((m) => m.user_id);
  if (ids.length < 2) throw new Error("Both people need to be in the connection.");
  const [m1, m2] = ids;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids);
  const nameFor = (uid: string) =>
    profiles?.find((p) => p.id === uid)?.display_name ?? "";
  const redactor = buildRedactor([nameFor(m1), nameFor(m2)]);

  // Build Q/A items; include only instances where both answers are visible.
  const items: DigestItem[] = [];
  const rawParts: string[] = [];
  for (const inst of instances) {
    const r1 = responses?.find(
      (r) => r.instance_id === inst.id && r.user_id === m1,
    );
    const r2 = responses?.find(
      (r) => r.instance_id === inst.id && r.user_id === m2,
    );
    if (!r1 || !r2) continue;
    const a1 = (r1.answers ?? {}) as Record<string, string>;
    const a2 = (r2.answers ?? {}) as Record<string, string>;
    const title =
      inst.kind === "daily"
        ? `Daily question${inst.revealed_at ? ` (${inst.revealed_at.slice(0, 10)})` : ""}`
        : inst.kind;
    for (const q of inst.questions as PromptQuestion[]) {
      rawParts.push(`${a1[q.id] ?? ""} ${a2[q.id] ?? ""}`);
      items.push({
        title,
        question: q.text,
        p1: redactor.redact(a1[q.id] ?? ""),
        p2: redactor.redact(a2[q.id] ?? ""),
      });
    }
  }
  if (items.length === 0) {
    throw new Error(
      "Nothing to digest yet — answer a few daily questions together this week first.",
    );
  }
  const trimmed = items.slice(0, MAX_ITEMS);

  // Safety: regex on raw text, model pass on redacted; high severity withholds.
  const signal = await assessSafety(rawParts.join("\n"), redactor.redact);

  const admin = createAdminClient();

  if (signal.severity === "high") {
    await admin.from("safety_events").insert({
      user_id: user.id,
      category: signal.categories[0] ?? "abuse",
      surfaced_resources: { categories: signal.categories } as Json,
    });
    await admin.from("relationship_insights").insert({
      connection_id: connectionId,
      kind: "weekly_digest",
      audience: "shared",
      summary: "Support resources",
      payload: { safety: true, categories: signal.categories } as Json,
      safety_flags: { severity: "high", categories: signal.categories, reviewed: false } as Json,
    });
    await logAudit(user.id, "digest.withheld_safety", connectionId);
    revalidatePath(`/connections/${connectionId}`);
    return;
  }

  const content = await grokChat(
    [digestSystemPrompt(), digestUserPrompt(conn.type, trimmed)],
    { json: true },
  );
  const digest = parseDigest(content);

  await admin.from("relationship_insights").insert({
    connection_id: connectionId,
    kind: "weekly_digest",
    audience: "shared",
    summary: digest.reflection.slice(0, 200),
    payload: digest as unknown as Json,
    model: process.env.XAI_MODEL ?? "grok-4",
    safety_flags: { severity: signal.severity, categories: signal.categories } as Json,
  });
  await logAudit(user.id, "digest.generate", connectionId);

  revalidatePath(`/connections/${connectionId}`);
}
