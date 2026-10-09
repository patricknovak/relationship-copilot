import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONNECTION_TYPES, connectionLabel } from "@/lib/relationships";
import {
  classifyInviteLookup,
  INVITE_FAILURE_COPY,
  type InviteFailureStatus,
} from "@/lib/inviteStatus";
import type { ConnectionType } from "@/lib/database.types";
import AutoAcceptInvite from "@/components/AutoAcceptInvite";
import AuthFragmentSession from "@/components/AuthFragmentSession";

// Static for every code — never look up the invite in generateMetadata.
// Unfurl caches and search indexes must not see inviter names, relationship
// types, or whether a code is valid.
export const metadata: Metadata = {
  title: {
    absolute: "You're invited — Relationship Copilot",
  },
  description:
    "Answer in private. Reveal together — only when you've both shared. Free to start.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "You're invited to a private space on Relationship Copilot",
    description:
      "Answer in private. Reveal together — only when you've both shared. Free to start.",
  },
  twitter: {
    card: "summary_large_image",
    title: "You're invited to a private space on Relationship Copilot",
    description:
      "Answer in private. Reveal together — only when you've both shared. Free to start.",
  },
};

type InvitePreview =
  | {
      status: "ok";
      connectionId: string;
      type: ConnectionType;
      createdBy: string | null;
      inviterName: string | null;
    }
  | { status: InviteFailureStatus };

// Possession of the (unguessable, single-use) code authorizes the preview.
// Admin client is read-only for the minimal fields shown. Used vs unknown
// comes from retired_invite_codes (0019); malformed/unknown never say "used".
async function loadInvitePreview(code: string): Promise<InvitePreview> {
  const admin = createAdminClient();
  const normalized = code.toUpperCase();

  const { data: conn } = await admin
    .from("connections")
    .select("id, type, created_by, invite_expires_at")
    .eq("invite_code", normalized)
    .maybeSingle();

  let retiredAsUsed = false;
  if (!conn) {
    const { data: retired } = await admin
      .from("retired_invite_codes")
      .select("reason")
      .eq("code", normalized)
      .maybeSingle();
    retiredAsUsed = retired?.reason === "used";
  }

  const expired = !!(
    conn?.invite_expires_at &&
    new Date(conn.invite_expires_at) <= new Date()
  );

  const status = classifyInviteLookup({
    code,
    foundActive: !!conn,
    expired,
    retiredAsUsed,
  });

  if (status !== "ok") return { status };

  // created_by can be null if the creator's account was since deleted.
  let inviterName: string | null = null;
  if (conn!.created_by) {
    const { data: inviter } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", conn!.created_by)
      .maybeSingle();
    inviterName = inviter?.display_name?.trim() || null;
  }
  return {
    status: "ok",
    connectionId: conn!.id,
    type: conn!.type,
    createdBy: conn!.created_by,
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

  if (invite.status !== "ok") {
    const copy = INVITE_FAILURE_COPY[invite.status];
    return (
      <Shell>
        <p className="eyebrow">Invitation</p>
        <h1 className="mt-3 text-3xl leading-snug">{copy.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{copy.body}</p>
        <p className="mt-2 text-sm font-medium text-ink">{copy.askPartner}</p>
        <div className="mt-8 flex flex-col items-center gap-3">
          {user ? (
            <Link href="/connections" className="btn-primary !px-8 !py-3">
              {copy.connectionsLabel}
            </Link>
          ) : (
            <>
              <Link
                href="/login?next=/connections/new"
                className="btn-primary !px-8 !py-3"
              >
                {copy.startOwnLabel}
              </Link>
              <Link href="/login" className="btn-ghost !px-4 !py-2 text-sm">
                Sign in
              </Link>
            </>
          )}
        </div>
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
          : "You've been invited to connect"}
      </h1>
      <p className="mt-2 text-sm font-medium text-brand-700 dark:text-brand-300">
        {connectionLabel(invite.type)}
        {typeBlurb ? ` — ${typeBlurb}` : ""}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        You&apos;ll each answer the same thoughtful questions in a private space.
        Neither of you sees the other&apos;s answers until you&apos;ve both
        shared — then you reveal together. It&apos;s free, and you can leave
        anytime.
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
            Continue with Google — no password to invent.
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
