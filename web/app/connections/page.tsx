import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { connectionLabel } from "@/lib/relationships";

const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting to connect",
  onboarding: "Getting started",
  active: "Active",
  archived: "Archived",
  blocked: "Blocked",
};

export default async function ConnectionsPage() {
  const supabase = await createClient();
  // RLS scopes this to the signed-in user's connections.
  const { data: connections } = await supabase
    .from("connections")
    .select("id, type, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl">Your connections</h1>
        <Link href="/connections/new" className="btn-primary">
          + New connection
        </Link>
      </div>

      {!connections || connections.length === 0 ? (
        <div className="card mt-10 !rounded-3xl border-dashed !border-brand-200 p-10 text-center">
          <p className="font-display text-xl text-ink">
            Your first connection starts here
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
            Create one and invite someone — partner, friend, family — to start
            the 20 questions together.
          </p>
          <Link href="/connections/new" className="btn-primary mt-5">
            Start a connection
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {connections.map((c) => (
            <li key={c.id}>
              <Link
                href={`/connections/${c.id}`}
                className="card card-hover block"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg text-ink">
                    {connectionLabel(c.type)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      c.status === "active"
                        ? "bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-200"
                        : "bg-paper-warm text-ink-soft"
                    }`}
                  >
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
