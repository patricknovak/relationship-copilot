import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { startElective } from "@/app/actions/prompts";
import PendingButton from "@/components/PendingButton";
import NoticeBanner from "@/components/NoticeBanner";
import { Icon } from "@/components/ui/Icon";
import EmptyState from "@/components/ui/EmptyState";

const KIND_LABEL: Record<string, string> = {
  quiz: "Quiz",
  challenge: "Challenge",
};

export default async function ExplorePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const { notice } = await searchParams;
  const supabase = await createClient();

  const { data: conn } = await supabase
    .from("connections")
    .select("id, type")
    .eq("id", id)
    .maybeSingle();
  if (!conn) notFound();

  const { data: templates } = await supabase
    .from("prompt_templates")
    .select("id, kind, title, description, relationship_type")
    .in("kind", ["quiz", "challenge"])
    .eq("active", true)
    .or(`relationship_type.eq.${conn.type},relationship_type.is.null`)
    .order("kind");

  const { data: mine } = await supabase
    .from("prompt_instances")
    .select("id, kind, status, template_id, created_at")
    .eq("connection_id", id)
    .in("kind", ["quiz", "challenge"])
    .order("created_at", { ascending: false });

  const quizzes = (templates ?? []).filter((t) => t.kind === "quiz");
  const challenges = (templates ?? []).filter((t) => t.kind === "challenge");
  // Latest state per template so the list says what you've already done.
  const stateByTemplate = new Map<string, "revealed" | "open">();
  for (const m of mine ?? []) {
    if (!m.template_id || stateByTemplate.has(m.template_id)) continue;
    stateByTemplate.set(m.template_id, m.status === "revealed" ? "revealed" : "open");
  }

  return (
    <div className="page has-tabbar">
      <Link href={`/connections/${id}`} className="back-link">
        <Icon name="arrow-left" className="h-4 w-4" />
        Back
      </Link>
      <p className="eyebrow mt-3">Do together</p>
      <h1 className="mt-2 text-display-md">Quizzes &amp; challenges</h1>
      <p className="mt-3 text-ink-soft">
        Pick one to do together — you&apos;ll each answer, then reveal.
      </p>

      <NoticeBanner
        tone="info"
        message={
          notice === "waiting"
            ? "Once your person joins, you can start activities together."
            : notice === "unavailable"
              ? "That activity isn't available right now — pick another."
              : null
        }
      />

      {(templates ?? []).length === 0 && (
        <div className="mt-8">
          <EmptyState
            icon="grid"
            title="Nothing here yet"
            body="New quizzes and challenges for this relationship type are on the way — in the meantime, today's question is always waiting."
          />
        </div>
      )}

      <Group title="Challenges" items={challenges} connectionId={id} state={stateByTemplate} />
      <Group title="Quizzes" items={quizzes} connectionId={id} state={stateByTemplate} />

      {mine && mine.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg">Your activities</h2>
          <ul className="mt-3 space-y-2">
            {mine.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/connections/${id}/prompts/${m.id}`}
                  className="card card-hover flex items-center gap-3 !p-3.5 text-sm"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${m.kind === "quiz" ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200" : "bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-200"}`}>
                    <Icon name={m.kind === "quiz" ? "layers" : "flame"} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-base text-ink">
                      {(templates ?? []).find((t) => t.id === m.template_id)
                        ?.title ?? (KIND_LABEL[m.kind] ?? m.kind)}
                    </span>
                    <span className="block text-xs text-ink-soft">
                      {KIND_LABEL[m.kind] ?? m.kind}
                    </span>
                  </span>
                  <span className={m.status === "revealed" ? "pill-done" : "pill-quiet"}>
                    {m.status === "revealed" ? "Revealed" : "In progress"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Group({
  title,
  items,
  connectionId,
  state,
}: {
  title: string;
  items: { id: string; title: string | null; description: string | null }[];
  connectionId: string;
  state: Map<string, "revealed" | "open">;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-lg">
        <Icon name={title === "Quizzes" ? "layers" : "flame"} className="h-5 w-5 text-brand-600 dark:text-brand-300" />
        {title}
      </h2>
      <ul className="stagger mt-3 grid gap-3 sm:grid-cols-2">
        {items.map((t) => {
          const start = startElective.bind(null, connectionId, t.id);
          const st = state.get(t.id);
          return (
            <li key={t.id} className="card card-hover flex flex-col !p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-lg leading-snug text-ink">{t.title}</p>
                {st === "revealed" && <span className="pill-done">Done</span>}
                {st === "open" && <span className="pill-quiet">In progress</span>}
              </div>
              {t.description && (
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-soft">
                  {t.description}
                </p>
              )}
              <form action={start} className="mt-4">
                <PendingButton
                  className={st ? "btn-secondary btn-sm" : "btn-primary btn-sm"}
                  pendingLabel="Starting…"
                >
                  {st === "revealed" ? "Do it again" : "Start"}
                  <Icon name="arrow-right" className="h-3.5 w-3.5" />
                </PendingButton>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
