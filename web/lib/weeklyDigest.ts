// The weekly digest, shared by the manual button (app/actions/digest.ts) and
// generate-on-visit (components/WeeklyDigest.tsx, decision 0001 option A).
// Server-only. Same contract as the Blueprint: premium-gated, safety
// assessment first (high severity withholds output and surfaces support),
// redaction before anything reaches the model. Every read goes through the
// caller's session client, so the reveal gate in RLS bounds exactly what the
// digest can see; the service role only claims the rate-limit slot, writes
// the finished insight and logs.

import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildRedactor } from "@/lib/redact";
import { assessSafety } from "@/lib/safetyClassifier";
import { logAudit } from "@/lib/audit";
import { grokChat, grokModel } from "@/lib/grok";
import { digestSystemPrompt, digestUserPrompt, parseDigest, type DigestItem } from "@/lib/digest";
import {
  claimInsightSlot,
  finalizeInsightClaim,
  releaseInsightClaim,
} from "@/lib/insightRateLimit";
import type { PromptQuestion, Json } from "@/lib/database.types";

type Session = Awaited<ReturnType<typeof createClient>>;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const DIGEST_MIN_GAP_MS = 6 * 24 * 60 * 60 * 1000; // one digest per ~week
const MAX_ITEMS = 24; // cap prompt size

export type DigestOutcome =
  | "ok"
  | "withheld" // safety: support resources shown instead
  | "inactive"
  | "premium"
  | "empty"
  | "solo"
  | "gap"
  | "ai";

export async function runWeeklyDigest(
  supabase: Session,
  userId: string,
  connectionId: string,
  mode: "manual" | "auto",
): Promise<DigestOutcome> {
  const { data: conn } = await supabase
    .from("connections")
    .select("id, type, status")
    .eq("id", connectionId)
    .maybeSingle();
  if (!conn || conn.status !== "active") return "inactive";

  // Premium covers the connection: either member's plan unlocks the digest.
  const { data: isPremium } = await supabase.rpc("connection_has_premium", {
    p_conn: connectionId,
  });
  if (!isPremium) return "premium";

  // Last week's revealed activity (daily questions, quizzes, challenges).
  const since = new Date(Date.now() - WEEK_MS).toISOString();
  const { data: instances } = await supabase
    .from("prompt_instances")
    .select("id, kind, questions, revealed_at, template_id")
    .eq("connection_id", connectionId)
    .eq("status", "revealed")
    .gte("revealed_at", since)
    .order("revealed_at", { ascending: true });
  if (!instances || instances.length === 0) return "empty";

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
  // Sorted so which participant is P1 is stable across regenerations.
  const ids = (members ?? []).map((m) => m.user_id).sort();
  if (ids.length < 2) return "solo";
  const [m1, m2] = ids;

  const { data: profiles } = await supabase
    .from("partner_profiles")
    .select("id, display_name")
    .in("id", ids);
  const nameFor = (uid: string) =>
    profiles?.find((p) => p.id === uid)?.display_name ?? "";
  const redactor = buildRedactor([nameFor(m1), nameFor(m2)]);

  // Build Q/A items; include only instances where both answers are visible.
  const items: DigestItem[] = [];
  const rawParts: string[] = [];
  for (const inst of instances) {
    const r1 = responses?.find((r) => r.instance_id === inst.id && r.user_id === m1);
    const r2 = responses?.find((r) => r.instance_id === inst.id && r.user_id === m2);
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
  if (items.length === 0) return "empty";
  const trimmed = items.slice(0, MAX_ITEMS);

  // Open shared goals, as context only (RLS: members). Redacted like answers.
  const { data: goalRows } = await supabase
    .from("connection_goals")
    .select("body")
    .eq("connection_id", connectionId)
    .is("done_at", null)
    .order("created_at", { ascending: true })
    .limit(10);
  const goals = (goalRows ?? []).map((g) => redactor.redact(g.body));
  rawParts.push(...(goalRows ?? []).map((g) => g.body));

  // Atomic rate limit after readiness: claim a slot before the model call.
  const admin = createAdminClient();
  const slot = await claimInsightSlot(admin, connectionId, "weekly_digest", DIGEST_MIN_GAP_MS);
  if (!slot.ok) return "gap";
  const claimId = slot.claim.id;

  // Safety: regex on raw text, model pass on redacted; high severity withholds.
  const signal = await assessSafety(rawParts.join("\n"), redactor.redact);

  if (signal.severity === "high") {
    await admin.from("safety_events").insert({
      user_id: userId,
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
    await logAudit(userId, "digest.withheld_safety", connectionId, { mode });
    return "withheld";
  }

  let digest;
  try {
    const content = await grokChat(
      [digestSystemPrompt(), digestUserPrompt(conn.type, trimmed, goals)],
      { json: true },
    );
    digest = parseDigest(content);
  } catch {
    await releaseInsightClaim(admin, claimId);
    return "ai";
  }

  await finalizeInsightClaim(admin, claimId, {
    summary: digest.reflection.slice(0, 200),
    payload: digest as unknown as Json,
    model: grokModel(),
    safety_flags: {
      severity: signal.severity,
      categories: signal.categories,
    } as Json,
  });
  await logAudit(userId, mode === "auto" ? "digest.auto_generate" : "digest.generate", connectionId);
  return "ok";
}
