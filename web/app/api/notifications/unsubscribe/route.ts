import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifySecret } from "@/lib/notify";
import { ALL_OFF, verifyUnsubscribeToken, withNotificationPrefs } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import type { Json } from "@/lib/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-click unsubscribe from notification emails. The link carries the user
// id and an HMAC over it; a valid pair switches every notification off for
// that user. No sign-in needed (mail clients and the List-Unsubscribe header
// hit this without a session), and the only effect is fewer emails.
//
// GET only shows a confirm button: corporate link scanners and some clients
// prefetch GET links, and a prefetch must not unsubscribe anyone. POST does
// the change (the RFC 8058 one-click header also POSTs).
function page(title: string, body: string, status = 200, form?: string) {
  return new NextResponse(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>
<body style="margin:0;padding:48px 16px;background:#fbf8f4;color:#221a22;font-family:Georgia,'Times New Roman',serif;line-height:1.55">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e8ddd8;border-radius:16px;padding:32px 28px">
<h1 style="font-size:22px;margin:0 0 12px">${title}</h1>
<p style="margin:0 0 20px;font-size:16px">${body}</p>
${form ?? ""}
<p style="margin:0;font-size:14px"><a href="/account" style="color:#74386f">Notification settings</a> &middot; <a href="/" style="color:#74386f">Relationship Copilot</a></p>
</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function params(req: Request) {
  const url = new URL(req.url);
  return {
    userId: url.searchParams.get("u") ?? "",
    token: url.searchParams.get("t") ?? "",
  };
}

function valid(userId: string, token: string): boolean {
  const secret = notifySecret();
  return !!secret && verifyUnsubscribeToken(userId, token, secret);
}

const INVALID = () =>
  page(
    "That link didn't work",
    "The unsubscribe link is missing or no longer valid. You can change notification settings from your account at any time.",
    400,
  );

export async function GET(req: Request) {
  const { userId, token } = params(req);
  if (!valid(userId, token)) return INVALID();
  const action = new URL(req.url);
  const escapedAction = `${action.pathname}${action.search}`.replace(/"/g, "&quot;");
  return page(
    "Stop notification emails?",
    "This turns off every notification email for your account. Sign-in links and invites you request still arrive, and you can switch individual notifications back on from your account.",
    200,
    `<form method="post" action="${escapedAction}" style="margin:0 0 20px"><button type="submit" style="background:#74386f;color:#fff;border:0;border-radius:999px;padding:12px 22px;font-size:15px;font-weight:600;font-family:system-ui,-apple-system,sans-serif;cursor:pointer">Yes, stop these emails</button></form>`,
  );
}

export async function POST(req: Request) {
  const { userId, token } = params(req);
  if (!valid(userId, token)) return INVALID();

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) {
    return page("Nothing to change", "We couldn't find an account for that link.", 404);
  }
  const { error } = await admin
    .from("profiles")
    .update({
      preferences: withNotificationPrefs(profile.preferences, ALL_OFF) as unknown as Json,
    })
    .eq("id", userId);
  if (error) {
    return page("Something went wrong", "Please try again in a moment, or change notifications from your account.", 500);
  }
  await logAudit(userId, "notify.unsubscribe_all");
  return page(
    "You're unsubscribed",
    "We won't send you notification emails anymore. Sign-in links and invites you request still arrive. You can switch individual notifications back on from your account.",
  );
}
