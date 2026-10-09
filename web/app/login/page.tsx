import { createAdminClient } from "@/lib/supabase/admin";
import { safeNextPath } from "@/lib/redirect";
import { inviteCodeFromNext, loginIntentFromNext } from "@/lib/inviteStatus";
import LoginForm from "./LoginForm";

// Server page: resolve invitee display name (never IDs) when next=/invite/CODE,
// then hand a safe next path to the client form. Keeps open-redirect guards
// on both sides (here + auth callback/confirm).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next, "");
  const intent = loginIntentFromNext(nextPath || null);

  let inviterName: string | null = null;
  if (intent.kind === "invitee") {
    inviterName = await lookupInviterDisplayName(intent.inviteCode);
  }

  return <LoginForm nextPath={nextPath} inviterName={inviterName} />;
}

/** Display name only — admin read of the open invite's creator profile. */
async function lookupInviterDisplayName(code: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data: conn } = await admin
      .from("connections")
      .select("created_by, invite_expires_at")
      .eq("invite_code", code)
      .maybeSingle();
    if (!conn?.created_by) return null;
    if (
      conn.invite_expires_at &&
      new Date(conn.invite_expires_at) <= new Date()
    ) {
      return null;
    }
    const { data: inviter } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", conn.created_by)
      .maybeSingle();
    return inviter?.display_name?.trim() || null;
  } catch {
    // Missing env / admin client in local — fall back to nameless invite copy.
    return null;
  }
}
