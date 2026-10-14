import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Deploy verification: which commit is live, and on which host. No secrets,
// no database call (uptime checks must not depend on Supabase). The deploy
// passes GIT_COMMIT_SHA with `wrangler deploy --var GIT_COMMIT_SHA:<sha>`.
export function GET() {
  return NextResponse.json(
    {
      ok: true,
      commit: process.env.GIT_COMMIT_SHA || null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
