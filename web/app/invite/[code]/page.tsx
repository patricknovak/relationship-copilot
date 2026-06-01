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
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">You&apos;re invited to connect</h1>
      <p className="mt-2 text-gray-600">
        Someone wants to build a closer relationship with you on Relationship
        Copilot. Accept to start the 20 questions together.
      </p>

      {user ? (
        <form action={accept} className="mt-8">
          <button className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
            Accept invite
          </button>
        </form>
      ) : (
        <Link
          href={`/login?next=/invite/${code}`}
          className="mt-8 inline-block rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Sign in to accept
        </Link>
      )}

      <p className="mt-6 text-xs text-gray-400">
        Invite code: <span className="font-mono">{code}</span>
      </p>
    </div>
  );
}
