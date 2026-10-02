import { describe, expect, it } from "vitest";
import { ensureOnboardingInstance } from "./onboarding";
import { ONBOARDING_DATE } from "./relationships";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PromptQuestion } from "./database.types";

type InstanceRow = {
  id: string;
  connection_id: string;
  kind: string;
  template_id: string;
  questions: PromptQuestion[];
  scheduled_for: string;
  status: string;
};

/**
 * Minimal in-memory Supabase stand-in that exercises the select → upsert →
 * re-select path of ensureOnboardingInstance, including ignoreDuplicates
 * races on the (connection_id, kind, scheduled_for) unique key.
 */
function makeFakeSupabase(opts: {
  connectionId: string;
  connectionType?: string;
  questions?: PromptQuestion[];
}) {
  const connectionId = opts.connectionId;
  const connectionType = opts.connectionType ?? "romantic";
  const questions = opts.questions ?? [
    { id: "q1", text: "One?" },
    { id: "q2", text: "Two?" },
  ];
  const templateId = "tmpl-onboarding";
  const instances: InstanceRow[] = [];
  let nextId = 1;

  type Filters = Record<string, string>;

  function matches(row: InstanceRow, filters: Filters): boolean {
    return Object.entries(filters).every(
      ([k, v]) => (row as Record<string, unknown>)[k] === v,
    );
  }

  function from(table: string) {
    if (table === "connections") {
      return {
        select() {
          return {
            eq(_col: string, id: string) {
              return {
                async single() {
                  if (id !== connectionId) return { data: null, error: null };
                  return { data: { type: connectionType }, error: null };
                },
              };
            },
          };
        },
      };
    }

    if (table === "prompt_templates") {
      return {
        select() {
          return {
            eq() {
              return this;
            },
            or() {
              return this;
            },
            order() {
              return this;
            },
            limit() {
              return this;
            },
            async maybeSingle() {
              return {
                data: {
                  id: templateId,
                  questions,
                  relationship_type: connectionType,
                },
                error: null,
              };
            },
          };
        },
      };
    }

    if (table === "prompt_instances") {
      const filters: Filters = {};
      let pendingInsert: Omit<InstanceRow, "id"> | null = null;
      let ignoreDuplicates = false;
      const api = {
        select(_cols?: string) {
          return api;
        },
        eq(col: string, value: string) {
          filters[col] = value;
          return api;
        },
        async maybeSingle() {
          if (pendingInsert) {
            const conflict = instances.find(
              (r) =>
                r.connection_id === pendingInsert!.connection_id &&
                r.kind === pendingInsert!.kind &&
                r.scheduled_for === pendingInsert!.scheduled_for,
            );
            if (conflict) {
              if (ignoreDuplicates) {
                pendingInsert = null;
                return { data: null, error: null };
              }
              pendingInsert = null;
              return {
                data: null,
                error: { message: "duplicate key" },
              };
            }
            const row: InstanceRow = {
              id: `inst-${nextId++}`,
              ...pendingInsert,
            };
            instances.push(row);
            pendingInsert = null;
            return { data: { id: row.id }, error: null };
          }
          const row = instances.find((r) => matches(r, filters));
          return { data: row ? { id: row.id } : null, error: null };
        },
        upsert(
          row: Omit<InstanceRow, "id">,
          opts?: { onConflict?: string; ignoreDuplicates?: boolean },
        ) {
          pendingInsert = row;
          ignoreDuplicates = !!opts?.ignoreDuplicates;
          return api;
        },
      };
      return api;
    }

    throw new Error(`unexpected table ${table}`);
  }

  return {
    client: { from } as unknown as SupabaseClient<Database>,
    instances,
  };
}

describe("ensureOnboardingInstance", () => {
  const connectionId = "conn-1";

  it("creates exactly one instance when called twice", async () => {
    const { client, instances } = makeFakeSupabase({ connectionId });

    const first = await ensureOnboardingInstance(client, connectionId);
    const second = await ensureOnboardingInstance(client, connectionId);

    expect(first).toBeTruthy();
    expect(second).toBe(first);
    expect(instances).toHaveLength(1);
    expect(instances[0]?.kind).toBe("onboarding");
    expect(instances[0]?.scheduled_for).toBe(ONBOARDING_DATE);
    expect(instances[0]?.connection_id).toBe(connectionId);
  });

  it("creates exactly one instance under concurrent calls", async () => {
    const { client, instances } = makeFakeSupabase({ connectionId });

    const [a, b] = await Promise.all([
      ensureOnboardingInstance(client, connectionId),
      ensureOnboardingInstance(client, connectionId),
    ]);

    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).toBe(b);
    expect(instances).toHaveLength(1);
  });
});
