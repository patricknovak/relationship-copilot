import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { connectionLabel } from "@/lib/relationships";
import { startOnboarding } from "@/app/actions/prompts";
import InviteShare from "@/components/InviteShare";

export default async function ConnectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: conn } = await supabase
    .from("connections")
    .select("id, type, status, invite_code, created_by")
    .eq("id", id)
    .maybeSingle();
  if (!conn) notFound();

  const { data: members } = await supabase
    .from("connection_members")
    .select("user_id, role, joined_at")
    .eq("connection_id", id);
  const joinedCount = (members ?? []).filter((m) => m.joined_at).length;

  const { data: instance } = await supabase
    .from("prompt_instances")
    .select("id, status")
    .eq("connection_id", id)
    .eq("kind", "onboarding")
    .maybeSingle();

  let myResponse = null;
  if (instance && user) {
    const { data } = await supabase
      .from("prompt_responses")
      .select("id")
      .eq("instance_id", instance.id)
      .eq("user_id", user.id)
      .maybeSingle();
    myResponse = data;
  }

  const begin = startOnboarding.bind(null, id);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const inviteUrl = conn.invite_code ? `${base}/invite/${conn.invite_code}` : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/connections" className="text-sm text-gray-500 hover:text-gray-700">
        ← All connections
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{connectionLabel(conn.type)}</h1>

      {/* Waiting for the other person to accept */}
      {inviteUrl && joinedCount < 2 && (
        <section className="mt-6 rounded-lg border border-brand-100 bg-brand-50/40 p-5">
          <h2 className="font-semibold text-brand-700">Invite your person</h2>
          <p className="mt-1 text-sm text-gray-600">
            Share this link. Once they join, you can both start the 20 questions.
          </p>
          <InviteShare url={inviteUrl} />
        </section>
      )}

      {/* Both joined — onboarding entry */}
      {joinedCount >= 2 && (
        <section className="mt-6 rounded-lg border border-gray-100 p-5">
          <h2 className="font-semibold">The first 20 questions</h2>
          {!instance ? (
            <>
              <p className="mt-1 text-sm text-gray-600">
                Answer thoughtfully — you&apos;ll each see the other&apos;s
                answers only after you&apos;ve both finished.
              </p>
              <form action={begin} className="mt-3">
                <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                  Begin the 20 questions
                </button>
              </form>
            </>
          ) : instance.status === "revealed" ? (
            <p className="mt-1 text-sm">
              <Link
                href={`/connections/${id}/onboarding`}
                className="text-brand-700 underline"
              >
                See your answers side by side →
              </Link>
            </p>
          ) : myResponse ? (
            <p className="mt-1 text-sm text-gray-600">
              You&apos;re done — waiting for the other person to finish.{" "}
              <Link
                href={`/connections/${id}/onboarding`}
                className="text-brand-700 underline"
              >
                Review your answers
              </Link>
            </p>
          ) : (
            <p className="mt-1 text-sm">
              <Link
                href={`/connections/${id}/onboarding`}
                className="text-brand-700 underline"
              >
                Continue the 20 questions →
              </Link>
            </p>
          )}
        </section>
      )}

      {/* Blueprint placeholder (premium, future increment) */}
      {conn.status === "active" && (
        <section className="mt-6 rounded-lg border border-gray-100 p-5 opacity-80">
          <h2 className="font-semibold">Relationship Blueprint</h2>
          <p className="mt-1 text-sm text-gray-500">
            Your AI-generated strengths, focus areas, and reflection — coming
            soon with Premium.
          </p>
        </section>
      )}
    </div>
  );
}
