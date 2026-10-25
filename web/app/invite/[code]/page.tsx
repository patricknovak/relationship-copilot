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
import { inviterAnsweredLine } from "@/lib/firstRevealCopy";
import { Avatar } from "@/components/ui/Avatar";
import { Icon, TYPE_ICON, TYPE_TINT } from "@/components/ui/Icon";
import { BrandTile } from "@/components/Brand";

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
      note: string | null;
      inviterAnswered: boolean;
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
    .select("id, type, created_by, invite_expires_at, status")
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

  // The inviter's personal note (0035), shown only while the code is valid
  // and the connection is still waiting for them. Leaving archives the
  // connection without burning the code, so a leaver's note must not keep
  // showing to whoever has the link.
  const { data: noteRow } =
    conn!.status === "pending"
      ? await admin
          .from("invite_notes")
          .select("note")
          .eq("connection_id", conn!.id)
          .maybeSingle()
      : { data: null };
  // Answer-first (0033): a boolean "they already answered", never content.
  // Failure just hides the line.
  const { data: answered } = await admin.rpc("invite_inviter_has_answered", {
    p_code: normalized,
  });

  return {
    status: "ok",
    connectionId: conn!.id,
    type: conn!.type,
    createdBy: conn!.created_by,
    inviterName,
    note: noteRow?.note ?? null,
    inviterAnswered: answered === true,
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
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-paper-warm text-ink-soft">
          <Icon name="clock" className="h-7 w-7" />
        </span>
        <p className="eyebrow mt-5">Invitation</p>
        <h1 className="mt-3 text-display-md">{copy.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{copy.body}</p>
        <p className="mt-2 text-sm font-medium text-ink">{copy.askPartner}</p>
        <div className="mt-8 flex flex-col items-center gap-3">
          {user ? (
            <Link href="/connections" className="btn-primary btn-lg">
              {copy.connectionsLabel}
            </Link>
          ) : (
            <>
              <Link
                href="/login?next=/connections/new"
                className="btn-primary btn-lg"
              >
                {copy.startOwnLabel}
              </Link>
              <Link href="/login" className="btn-ghost btn-sm">
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
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <Icon name="send" className="h-7 w-7" />
        </span>
        <p className="eyebrow mt-5">Your invite</p>
        <h1 className="mt-3 text-display-md">This link is for your person</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Send it to them by email or text — when they tap it, they&apos;ll
          join you here.
        </p>
        <Link
          href={`/connections/${invite.connectionId}`}
          className="btn-primary btn-lg mt-8"
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
      <div className="flex items-center justify-center">
        <Avatar name={invite.inviterName ?? "?"} size="xl" variant="them" />
        <span className="-ml-3 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-brand-300 bg-surface text-brand-400 ring-2 ring-surface dark:border-brand-700">
          <Icon name="plus" className="h-7 w-7" />
        </span>
      </div>
      <p className="eyebrow mt-6">An invitation</p>
      <h1 className="mt-3 text-display-md">
        {invite.inviterName
          ? `${invite.inviterName} invited you to connect`
          : "You've been invited to connect"}
      </h1>
      <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-paper-warm px-3 py-1.5 text-sm font-medium text-ink">
        <span className={`flex h-5 w-5 items-center justify-center rounded-full ${TYPE_TINT[invite.type]}`}>
          <Icon name={TYPE_ICON[invite.type]} className="h-3 w-3" strokeWidth={2} />
        </span>
        {connectionLabel(invite.type)}
      </p>
      {typeBlurb && <p className="mt-2 text-sm text-ink-soft">{typeBlurb}</p>}
      {invite.note && (
        <figure className="mt-5 rounded-2xl border border-accent-200/70 bg-accent-50/60 px-4 py-3 text-left dark:border-accent-900/40 dark:bg-accent-950/20">
          <blockquote className="whitespace-pre-wrap font-display text-lg leading-snug text-ink">
            &ldquo;{invite.note}&rdquo;
          </blockquote>
          <figcaption className="mt-1.5 text-xs text-ink-soft">
            {invite.inviterName ? `${invite.inviterName}, to you` : "From the person who invited you"}
          </figcaption>
        </figure>
      )}
      <ul className="mt-5 space-y-2 text-left text-sm text-ink-soft">
        <li className="flex items-start gap-2.5">
          <Icon name="eye-off" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" />
          You each answer the same thoughtful questions in private.
        </li>
        <li className="flex items-start gap-2.5">
          <Icon name="sparkles" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" />
          Nobody sees the other&apos;s answers until you&apos;ve both shared — then you reveal together.
        </li>
        <li className="flex items-start gap-2.5">
          <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" />
          It&apos;s free, and you can leave anytime.
        </li>
      </ul>
      {invite.inviterAnswered && (
        <p className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-brand-50/80 px-4 py-3 text-sm font-medium text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
          <Icon name="check" className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          {inviterAnsweredLine(invite.inviterName)}
        </p>
      )}

      {user ? (
        <AutoAcceptInvite code={code} />
      ) : (
        <>
          <Link
            href={`/login?next=/invite/${code}`}
            className="btn-primary btn-lg mt-8 w-full sm:w-auto"
          >
            Accept &amp; join free
            <Icon name="arrow-right" className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-xs text-ink-faint">
            Continue with Google — no password to invent.
          </p>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="hero-glow relative overflow-hidden">
      <div aria-hidden className="blob -left-20 top-10 h-64 w-64 animate-drift bg-brand-300/40 dark:bg-brand-700/30" />
      <div aria-hidden className="blob -right-20 bottom-10 h-64 w-64 animate-drift bg-accent-200/50 [animation-delay:-5s] dark:bg-accent-900/25" />
      {/* Consumes invite-email auth tokens from the URL fragment, then
          refreshes so the signed-in view (auto-join) renders. */}
      <AuthFragmentSession />
      <div className="relative mx-auto max-w-md px-4 py-14 text-center sm:py-20">
        <p className="mb-5 flex flex-col items-center justify-center gap-3 font-display text-sm text-ink-soft">
          <BrandTile className="h-14 w-14 drop-shadow-xl" />
          Relationship Copilot
        </p>
        <div className="card-hero animate-pop !p-8 sm:!p-10">
          {children}
        </div>
      </div>
    </div>
  );
}
