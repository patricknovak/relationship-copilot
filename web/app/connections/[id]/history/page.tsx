import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { connectionLabel } from "@/lib/relationships";
import type { PromptQuestion } from "@/lib/database.types";
import { Icon, type IconName } from "@/components/ui/Icon";
import EmptyState from "@/components/ui/EmptyState";

const KIND_LABEL: Record<string, string> = {
  onboarding: "First questions",
  daily: "Daily question",
  quiz: "Quiz",
  challenge: "Challenge",
};
const KIND_ICON: Record<string, IconName> = {
  onboarding: "sparkles",
  daily: "calendar",
  quiz: "layers",
  challenge: "flame",
};

// Everything this pair has revealed, newest first. Reads go through the
// session client, so the RLS reveal gate decides what appears: an instance
// is listed only once its status is revealed, never while one side is still
// private.
export default async function HistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: conn } = await supabase
    .from("connections")
    .select("id, type")
    .eq("id", id)
    .maybeSingle();
  if (!conn) notFound();

  const { data: revealed } = await supabase
    .from("prompt_instances")
    .select("id, kind, questions, revealed_at, scheduled_for, template_id")
    .eq("connection_id", id)
    .eq("status", "revealed")
    .order("revealed_at", { ascending: false })
    .limit(200);

  const templateIds = Array.from(
    new Set((revealed ?? []).map((r) => r.template_id).filter((x): x is string => !!x)),
  );
  const { data: templates } = templateIds.length
    ? await supabase.from("prompt_templates").select("id, title").in("id", templateIds)
    : { data: [] as { id: string; title: string | null }[] };
  const titleOf = (tid: string | null) =>
    tid ? (templates?.find((t) => t.id === tid)?.title ?? null) : null;

  const items = (revealed ?? []).map((r) => {
    const qs = Array.isArray(r.questions) ? (r.questions as PromptQuestion[]) : [];
    const first = qs[0]?.text ?? "";
    const date = r.revealed_at ?? r.scheduled_for ?? null;
    return {
      id: r.id,
      kind: r.kind,
      title:
        r.kind === "daily" || r.kind === "onboarding"
          ? first
          : (titleOf(r.template_id) ?? first),
      count: qs.length,
      date,
    };
  });

  return (
    <div className="page has-tabbar">
      <Link href={`/connections/${id}`} className="back-link">
        <Icon name="arrow-left" className="h-4 w-4" />
        Back
      </Link>
      <p className="eyebrow mt-3">{connectionLabel(conn.type)}</p>
      <h1 className="mt-2 text-display-md">Everything you&apos;ve revealed</h1>
      <p className="mt-3 text-sm text-ink-soft">
        {items.length === 0
          ? "Nothing revealed yet. Once you've both answered something, it lands here."
          : `${items.length} reveal${items.length === 1 ? "" : "s"} so far, newest first.`}
      </p>

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon="history" title="Your history starts with one reveal" body="Answer something together and it lands here, newest first." />
        </div>
      ) : (
        <ol className="relative mt-8 space-y-3 border-l border-surface-line pl-6">
          {items.map((it) => (
            <li key={it.id} className="relative">
              <span className="absolute -left-[31px] top-4 flex h-6 w-6 items-center justify-center rounded-full bg-surface text-brand-600 ring-2 ring-surface-line dark:text-brand-300">
                <Icon name={KIND_ICON[it.kind] ?? "sparkles"} className="h-3.5 w-3.5" />
              </span>
              <Link href={`/connections/${id}/prompts/${it.id}`} className="card card-hover block !p-4">
                <div className="flex items-center justify-between gap-3 text-xs text-ink-soft">
                  <span className="font-medium">{KIND_LABEL[it.kind] ?? it.kind}</span>
                  {it.date && (
                    <time dateTime={it.date}>
                      {new Date(it.date).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                  )}
                </div>
                <p className="mt-1.5 font-display text-lg leading-snug text-ink">
                  {it.title ? `“${it.title}”` : "Untitled"}
                </p>
                {it.count > 1 && (
                  <p className="mt-1 text-xs text-ink-faint">{it.count} questions</p>
                )}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
