import { NextResponse } from "next/server";
import { notificationConfigReport } from "@/lib/notifyConfig";

export const dynamic = "force-dynamic";

// Deploy verification: which commit is live, and on which host. No secrets,
// no database call (uptime checks must not depend on Supabase). The deploy
// passes GIT_COMMIT_SHA with `wrangler deploy --var GIT_COMMIT_SHA:<sha>`.
//
// `notifications` says which channels can send from this deploy (booleans
// only): after setting RESEND_API_KEY and NOTIFY_SECRET, `email` turning true
// here is the confirmation, with no need to wait for someone to answer.
export function GET() {
  const { email, push } = notificationConfigReport();
  return NextResponse.json(
    {
      ok: true,
      commit: process.env.GIT_COMMIT_SHA || null,
      notifications: { email, push },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
