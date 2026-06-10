"use client";

import { useState } from "react";
import { deleteAccount } from "@/app/actions/account";

// Danger-zone control: deletion is irreversible, so it's gated behind an
// explicit typed confirmation (also re-checked server-side).
export default function DeleteAccount() {
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(formData);
    } catch (e) {
      // Next.js redirect() throws by design — let it through.
      if (e && typeof e === "object" && "digest" in e) throw e;
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-rose-200 p-4">
      <h2 className="text-sm font-medium text-rose-700">Delete account</h2>
      <p className="mt-1 text-sm text-gray-600">
        This permanently deletes your profile, your answers, and your activity.
        If you share a connection with someone, they keep their own answers and
        the connection is archived for them; everything you wrote is removed.
        This cannot be undone.
      </p>
      <form action={onSubmit} className="mt-3 space-y-2">
        <label className="block text-xs text-gray-500" htmlFor="confirm-delete">
          Type <span className="font-mono font-semibold">DELETE</span> to confirm
        </label>
        <input
          id="confirm-delete"
          name="confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={confirm !== "DELETE" || busy}
          className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Permanently delete my account"}
        </button>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </form>
    </div>
  );
}
