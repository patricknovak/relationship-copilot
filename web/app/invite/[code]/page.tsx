import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONNECTION_TYPES, connectionLabel } from "@/lib/relationships";
import AutoAcceptInvite from "@/components/AutoAcceptInvite";
import AuthFragmentSession from "@/components/AuthFragmentSession";

// The invite landing page. Possession of the (unguessable, single-use) code
// is the authorization to see the preview, so the lookup uses the admin
// client read-only for the minimal fields shown: who invited you and what
// kind of connection it is. The reveal gate and membership writes stay
// entirely behind RLS / the accept_invite RPC.
async function loadInvitePreview(code: string) {
  const admin = createAdminClient();
  const { data: conn } = await admin
    .from("connections")
    .select("id, type, created_by, invite_expires_at")
    .eq("invite_code", code)
    .maybeSingle();
  if (!conn) return null;
  if (conn.invite_expires_at && new Date(conn.invite_expires_at) <= new Date()) {
    return null;
  }
  // created_by can be null if the creator's account was since deleted.
  let inviterName: string | null = null;
  if (conn.created_by) {
    const { data: inviter } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", conn.created_by)
      .maybeSingle();
    inviterName = inviter?.display_name?.trim() || null;
  }
  return {
    connectionId: conn.id,
    type: conn.type,
    createdBy: conn.created_by,
    inviterName,
  };
}

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

  const invite = await loadInvitePreview(code);

  if (!invite) {
    return (
      <Shell>
        <p className="eyebrow">Invitation</p>
        <h1 className="mt-3 text-3xl leading-snug">
          This invite has already been used or expired
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Invite links work once and then retire themselves. Ask your person
          for a fresh link{user ? "" : ", or sign in if you've already joined"}.
        </p>
        <Link
          href={user ? "/connections" : "/login"}
          className="btn-primary mt-8 !px-8 !py-3"
        >
          {user ? "Go to my connections" : "Sign in"}
        </Link>
      </Shell>
    );
  }

  // The creator following their own link: point them back at sharing it.
  if (user && user.id === invite.createdBy) {
    return (
      <Shell>
        <p className="eyebrow">Your invite</p>
        <h1 className="mt-3 text-3xl leading-snug">
          This link is for your person
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Send it to them by email or text — when they tap it, they&apos;ll
          join you here.
        </p>
        <Link
          href={`/connections/${invite.connectionId}`}
          className="btn-primary mt-8 !px-8 !py-3"
        >
          Back to your connection
        </Link>
      </Shell>
    );
  }

  // Already a member (e.g. re-tapping the email link) — straight in.
  if (user) {
    const { data: membership } = await supabase
      .from("connection_members")
      .select("connection_id")
      .eq("connection_id", invite.connectionId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membership) redirect(`/connections/${invite.connectionId}`);
  }

  const typeBlurb =
    CONNECTION_TYPES.find((t) => t.value === invite.type)?.blurb ?? "";

  return (
    <Shell>
      <p className="eyebrow">An invitation</p>
      <h1 className="mt-3 text-3xl leading-snug">
        {invite.inviterName
          ? `${invite.inviterName} invited you to connect`
          : "Someone wants to grow closer to you"}
      </h1>
      <p className="mt-2 text-sm font-medium text-brand-700 dark:text-brand-300">
        {connectionLabel(invite.type)}
        {typeBlurb ? ` — ${typeBlurb}` : ""}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        You&apos;ll answer questions together in a private space — neither of
        you can see the other&apos;s answer until you&apos;ve both shared.
        It&apos;s free.
      </p>

      {user ? (
        <AutoAcceptInvite code={code} />
      ) : (
        <>
          <Link
            href={`/login?next=/invite/${code}`}
            className="btn-primary mt-8 !px-8 !py-3"
          >
            Accept &amp; join free
          </Link>
          <p className="mt-3 text-xs text-ink-soft/70">
            Continue with Google or a one-tap email link — no password to
            invent.
          </p>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="hero-glow">
      {/* Consumes invite-email auth tokens from the URL fragment, then
          refreshes so the signed-in view (auto-join) renders. */}
      <AuthFragmentSession />
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="card !rounded-3xl !p-10 shadow-lift animate-fade-up">
          {children}
        </div>
      </div>
    </div>
  );
}
