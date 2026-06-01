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
        <h1 className="text-2xl font-bold">Your connections</h1>
        <Link
          href="/connections/new"
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          New connection
        </Link>
      </div>

      {!connections || connections.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-gray-200 p-8 text-center text-gray-500">
          <p>No connections yet.</p>
          <p className="mt-1 text-sm">
            Create one and invite someone to start the 20 questions together.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {connections.map((c) => (
            <li key={c.id}>
              <Link
                href={`/connections/${c.id}`}
                className="block rounded-lg border border-gray-100 p-4 hover:border-brand-200 hover:bg-brand-50/40"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{connectionLabel(c.type)}</span>
                  <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
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
