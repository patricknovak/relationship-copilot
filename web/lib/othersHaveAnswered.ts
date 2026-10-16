/**
 * Batch helper for the connections-list badge: one RPC instead of N
 * `others_have_answered` calls. Falls back to parallel singles if the batch
 * function is not migrated yet (0032) so previews keep working.
 */

import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type OthersAnsweredRow = {
  instance_id: string;
  answered: boolean;
};

/** Merge batch rows into a Set of instance ids where someone else answered. */
export function othersAnsweredSet(
  rows: OthersAnsweredRow[] | null | undefined,
): Set<string> {
  const out = new Set<string>();
  for (const r of rows ?? []) {
    if (r.answered) out.add(r.instance_id);
  }
  return out;
}

export async function fetchOthersHaveAnswered(
  supabase: Supabase,
  instanceIds: string[],
): Promise<Set<string>> {
  if (instanceIds.length === 0) return new Set();

  const { data, error } = await supabase.rpc("others_have_answered_many", {
    p_instances: instanceIds,
  });

  if (!error && data) {
    return othersAnsweredSet(data as OthersAnsweredRow[]);
  }

  // Migration 0032 not applied yet — preserve behaviour with parallel singles.
  const flags = await Promise.all(
    instanceIds.map(async (id) => {
      const { data: answered } = await supabase.rpc("others_have_answered", {
        p_instance: id,
      });
      return { instance_id: id, answered: !!answered };
    }),
  );
  return othersAnsweredSet(flags);
}
