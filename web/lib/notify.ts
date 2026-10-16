// Server-side notification orchestration. Uses the service-role client, so
// every entry point here must be reached only after the caller's authority is
// established (a member submitting their own answer, or the cron secret).
// What leaves our boundary: the recipient's address (from auth), a first
// name, a template question, and links. Never answer text.

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { emailConfigured, sendEmail } from "@/lib/email";
import {
  buildNotificationEmail,
  parseNotificationPrefs,
  PREF_FOR_KIND,
  unsubscribeUrl,
  type NotificationKind,
} from "@/lib/notifications";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://relationshipcopilot.com";
}

// Unsubscribe links are signed with NOTIFY_SECRET only. Do not fall back to
// the service-role key: rotating that key would invalidate every outstanding
// unsubscribe URL, and the blast radius is larger than a dedicated secret.
export function notifySecret(): string | null {
  return process.env.NOTIFY_SECRET || null;
}

type Admin = ReturnType<typeof createAdminClient>;

async function recipientEmail(admin: Admin, userId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

// Send one notification to one user about one instance, exactly once.
// Returns what happened so cron can report counts; never throws.
export async function notifyUser(input: {
  admin?: Admin;
  userId: string;
  instanceId: string;
  connectionId: string;
  kind: NotificationKind;
  themName: string | null;
  questionText?: string | null;
}): Promise<"sent" | "skipped_pref" | "skipped_dup" | "skipped_config" | "failed"> {
  const admin = input.admin ?? createAdminClient();
  const secret = notifySecret();
  if (!emailConfigured() || !secret) return "skipped_config";

  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("preferences")
      .eq("id", input.userId)
      .maybeSingle();
    const prefs = parseNotificationPrefs(profile?.preferences);
    if (!prefs[PREF_FOR_KIND[input.kind]]) return "skipped_pref";

    // Claim first; a conflict means this exact email already went out.
    const { data: claimed, error: claimError } = await admin
      .from("notification_log")
      .insert({
        instance_id: input.instanceId,
        user_id: input.userId,
        kind: input.kind,
      })
      .select("instance_id");
    if (claimError || !claimed || claimed.length === 0) return "skipped_dup";

    // From here on, any failure before a confirmed send releases the claim
    // so a later trigger can retry. A send that times out after the provider
    // accepted it is the one at-least-once case; a rare duplicate beats a
    // silently lost email.
    const release = () =>
      admin
        .from("notification_log")
        .delete()
        .eq("instance_id", input.instanceId)
        .eq("user_id", input.userId)
        .eq("kind", input.kind);

    let result: Awaited<ReturnType<typeof sendEmail>>;
    try {
      const to = await recipientEmail(admin, input.userId);
      if (!to) {
        await release();
        return "failed";
      }
      const site = siteUrl();
      const unsub = unsubscribeUrl(site, input.userId, secret);
      const email = buildNotificationEmail({
        kind: input.kind,
        themName: input.themName,
        questionText: input.questionText ?? null,
        instanceUrl:
          input.kind === "partner_joined"
            ? `${site}/connections/${input.connectionId}`
            : `${site}/connections/${input.connectionId}/prompts/${input.instanceId}`,
        unsubscribeUrl: unsub,
      });
      result = await sendEmail({ to, ...email, unsubscribeUrl: unsub });
    } catch (err) {
      await release();
      throw err;
    }
    if (!result.sent) {
      await release();
      return "failed";
    }
    // PII-minimal audit: kind and instance only.
    await logAudit(input.userId, "notify.email", input.instanceId, { kind: input.kind });
    return "sent";
  } catch (err) {
    console.error("[notify] notifyUser failed", err);
    return "failed";
  }
}

// After a member submits: tell the other member it's their turn, or that the
// reveal is open. `actorUserId` is the submitter (already authenticated and a
// member, or the RLS upsert would have failed).
export async function notifyOtherMembersAfterSubmit(input: {
  actorUserId: string;
  instanceId: string;
  connectionId: string;
  revealed: boolean;
}): Promise<void> {
  if (!emailConfigured()) return;
  const admin = createAdminClient();
  try {
    const { data: members } = await admin
      .from("connection_members")
      .select("user_id")
      .eq("connection_id", input.connectionId)
      .not("joined_at", "is", null);
    const others = (members ?? [])
      .map((m) => m.user_id)
      .filter((uid) => uid !== input.actorUserId);
    if (others.length === 0) return;

    const { data: actor } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", input.actorUserId)
      .maybeSingle();
    const actorName = actor?.display_name?.trim() || null;

    for (const uid of others) {
      await notifyUser({
        admin,
        userId: uid,
        instanceId: input.instanceId,
        connectionId: input.connectionId,
        kind: input.revealed ? "revealed" : "your_turn",
        themName: actorName,
      });
    }
  } catch (err) {
    console.error("[notify] after-submit failed", err);
  }
}

// After an invite is accepted: tell the other member(s) their person is in.
// `joinerUserId` just joined (the RPC succeeded, so membership is real).
// Logged against the onboarding instance; silently skipped if it isn't there.
export async function notifyPartnerJoined(input: {
  joinerUserId: string;
  connectionId: string;
}): Promise<void> {
  if (!emailConfigured()) return;
  const admin = createAdminClient();
  try {
    const { data: onboarding } = await admin
      .from("prompt_instances")
      .select("id")
      .eq("connection_id", input.connectionId)
      .eq("kind", "onboarding")
      .maybeSingle();
    if (!onboarding) return;

    const { data: members } = await admin
      .from("connection_members")
      .select("user_id")
      .eq("connection_id", input.connectionId)
      .not("joined_at", "is", null);
    const others = (members ?? [])
      .map((m) => m.user_id)
      .filter((uid) => uid !== input.joinerUserId);
    if (others.length === 0) return;

    const { data: joiner } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", input.joinerUserId)
      .maybeSingle();
    const joinerName = joiner?.display_name?.trim() || null;

    for (const uid of others) {
      await notifyUser({
        admin,
        userId: uid,
        instanceId: onboarding.id,
        connectionId: input.connectionId,
        kind: "partner_joined",
        themName: joinerName,
      });
    }
  } catch (err) {
    console.error("[notify] partner-joined failed", err);
  }
}

// After a discussion post: tell the other member(s), once per instance per
// recipient (the once-only key), never including the message.
export async function notifyDiscussionReply(input: {
  authorUserId: string;
  instanceId: string;
  connectionId: string;
}): Promise<void> {
  if (!emailConfigured()) return;
  const admin = createAdminClient();
  try {
    const { data: members } = await admin
      .from("connection_members")
      .select("user_id")
      .eq("connection_id", input.connectionId)
      .not("joined_at", "is", null);
    const others = (members ?? [])
      .map((m) => m.user_id)
      .filter((uid) => uid !== input.authorUserId);
    if (others.length === 0) return;

    const { data: author } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", input.authorUserId)
      .maybeSingle();
    const authorName = author?.display_name?.trim() || null;

    for (const uid of others) {
      await notifyUser({
        admin,
        userId: uid,
        instanceId: input.instanceId,
        connectionId: input.connectionId,
        kind: "discussion_reply",
        themName: authorName,
      });
    }
  } catch (err) {
    console.error("[notify] discussion-reply failed", err);
  }
}
