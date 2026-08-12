import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { startElective } from "@/app/actions/prompts";
import PendingButton from "@/components/PendingButton";
import NoticeBanner from "@/components/NoticeBanner";

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href={`/connections/${id}`} className="text-sm text-ink-soft/80 hover:text-ink-soft">
        ← Back
      </Link>
      <h1 className="mt-2 text-3xl">Quizzes &amp; challenges</h1>
      <p className="mt-2 text-ink-soft">
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
        <div className="card mt-8 !rounded-3xl border-dashed p-8 text-center">
          <p className="font-display text-lg text-ink">Nothing here yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
            New quizzes and challenges for this relationship type are on the
            way — in the meantime, today&apos;s question is always waiting.
          </p>
        </div>
      )}

      <Group title="Challenges" items={challenges} connectionId={id} />
      <Group title="Quizzes" items={quizzes} connectionId={id} />

      {mine && mine.length > 0 && (
        <section className="mt-10">
          <h2 className="font-semibold">Your activities</h2>
          <ul className="mt-3 space-y-2">
            {mine.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/connections/${id}/prompts/${m.id}`}
                  className="flex items-center justify-between rounded-md border border-gray-100 p-3 text-sm hover:border-brand-200"
                >
                  <span>
                    {(templates ?? []).find((t) => t.id === m.template_id)
                      ?.title ?? (KIND_LABEL[m.kind] ?? m.kind)}
                    <span className="ml-2 text-xs text-ink-soft/60">
                      {KIND_LABEL[m.kind] ?? m.kind}
                    </span>
                  </span>
                  <span className="text-xs text-ink-soft/80">
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
}: {
  title: string;
  items: { id: string; title: string | null; description: string | null }[];
  connectionId: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-3 space-y-3">
        {items.map((t) => {
          const start = startElective.bind(null, connectionId, t.id);
          return (
            <li key={t.id} className="card card-hover !p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg text-ink">{t.title}</p>
                  {t.description && (
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                      {t.description}
                    </p>
                  )}
                </div>
                <form action={start}>
                  <PendingButton
                    className="shrink-0 btn-primary !px-4 !py-1.5"
                    pendingLabel="Starting…"
                  >
                    Start
                  </PendingButton>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
