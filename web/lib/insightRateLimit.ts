/**
 * Atomic-ish rate limit for Blueprint / weekly digest generation.
 *
 * The old flow was check-then-act (SELECT recent → later INSERT), which two
 * concurrent requests can both pass. The claim pattern is insert-then-verify:
 * insert a placeholder insight first; if another real generation (or a fresh
 * in-flight claim) exists inside the gap window, delete the claim and treat it
 * as rate-limited. Only the winner proceeds to the expensive model call, then
 * updates the same row.
 *
 * Pending claims older than CLAIM_TTL_MS are ignored so a crashed function
 * cannot block digests for the full weekly gap.
 */

import type { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

type Admin = ReturnType<typeof createAdminClient>;

export type InsightKind = "blueprint" | "weekly_digest";

export type InsightClaim = {
  id: string;
  generated_at: string;
};

/** How long an in-flight `{ status: "generating" }` claim may block peers. */
export const CLAIM_TTL_MS = 5 * 60 * 1000;

const PENDING_PAYLOAD: Json = { status: "generating" };

export function isPendingInsightPayload(payload: unknown): boolean {
  return (
    !!payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    (payload as { status?: unknown }).status === "generating"
  );
}

/**
 * Pure decision: given other rows already in the gap window (excluding our
 * claim), should we release and rate-limit?
 */
export function claimBlockedBy(
  others: { payload: unknown; generated_at: string }[],
  nowMs: number = Date.now(),
  claimTtlMs: number = CLAIM_TTL_MS,
): boolean {
  return others.some((row) => {
    if (!isPendingInsightPayload(row.payload)) return true;
    return nowMs - new Date(row.generated_at).getTime() < claimTtlMs;
  });
}

/** @deprecated use claimBlockedBy — kept for narrow unit tests of count>1. */
export function claimLostRace(recentCount: number): boolean {
  return recentCount > 1;
}

export async function claimInsightSlot(
  admin: Admin,
  connectionId: string,
  kind: InsightKind,
  gapMs: number,
): Promise<{ ok: true; claim: InsightClaim } | { ok: false; reason: "ratelimit" }> {
  const since = new Date(Date.now() - gapMs).toISOString();

  const { data: inserted, error: insertError } = await admin
    .from("relationship_insights")
    .insert({
      connection_id: connectionId,
      kind,
      audience: "shared",
      summary: null,
      payload: PENDING_PAYLOAD,
    })
    .select("id, generated_at")
    .maybeSingle();

  if (insertError || !inserted) {
    return { ok: false, reason: "ratelimit" };
  }

  const { data: recent, error: recentError } = await admin
    .from("relationship_insights")
    .select("id, payload, generated_at")
    .eq("connection_id", connectionId)
    .eq("kind", kind)
    .gte("generated_at", since);

  if (recentError) {
    await admin.from("relationship_insights").delete().eq("id", inserted.id);
    return { ok: false, reason: "ratelimit" };
  }

  const others = (recent ?? []).filter((r) => r.id !== inserted.id);
  if (claimBlockedBy(others)) {
    await admin.from("relationship_insights").delete().eq("id", inserted.id);
    return { ok: false, reason: "ratelimit" };
  }

  return {
    ok: true,
    claim: { id: inserted.id, generated_at: inserted.generated_at },
  };
}

export async function finalizeInsightClaim(
  admin: Admin,
  claimId: string,
  row: {
    summary: string | null;
    payload: Json;
    model?: string | null;
    safety_flags: Json;
  },
): Promise<void> {
  await admin
    .from("relationship_insights")
    .update({
      summary: row.summary,
      payload: row.payload,
      model: row.model ?? null,
      safety_flags: row.safety_flags,
    })
    .eq("id", claimId);
}

export async function releaseInsightClaim(
  admin: Admin,
  claimId: string,
): Promise<void> {
  await admin.from("relationship_insights").delete().eq("id", claimId);
}
