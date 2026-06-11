import Link from "next/link";
import { acceptInvite } from "@/app/actions/connections";
import { createClient } from "@/lib/supabase/server";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const accept = acceptInvite.bind(null, code);

  return (
    <div className="hero-glow">
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="card !rounded-3xl !p-10 shadow-lift animate-fade-up">
          <p className="eyebrow">An invitation</p>
          <h1 className="mt-3 text-3xl leading-snug">
            Someone wants to grow closer to you
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Accept to open a private space for the two of you and start the
            20 questions together — your answers stay hidden until you&apos;ve
            both shared.
          </p>

          {user ? (
            <form action={accept} className="mt-8">
              <button className="btn-primary !px-8 !py-3">
                Accept invite
              </button>
            </form>
          ) : (
            <Link
              href={`/login?next=/invite/${code}`}
              className="btn-primary mt-8 !px-8 !py-3"
            >
              Sign in to accept
            </Link>
          )}
        </div>
        <p className="mt-5 text-xs text-ink-soft/60">
          Invite code: <span className="font-mono">{code}</span>
        </p>
      </div>
    </div>
  );
}
