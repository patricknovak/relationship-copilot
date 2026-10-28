"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/redirect";
import { ATTACHMENT_ITEMS, scoreAttachment } from "@/lib/attachment";
import type { Json } from "@/lib/database.types";
import { withNotificationPrefs } from "@/lib/notifications";

export async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  // Where to land after saving (e.g. back to the connection an invitee came
  // from). Validated to a same-origin path.
  // First-run default is the invite step, not /account.
  const next = safeNextPath(
    String(formData.get("next") || ""),
    "/connections/new",
  );
  const backWithError = (code: string): never =>
    redirect(`/onboarding?error=${code}&next=${encodeURIComponent(next)}`);

  const displayName = String(formData.get("display_name") || "")
    .trim()
    .slice(0, 80);
  const birthdayRaw = String(formData.get("birthday") || "").trim();
  const goals = String(formData.get("goals") || "")
    .trim()
    .slice(0, 2000);
  const values = String(formData.get("values") || "")
    .trim()
    .slice(0, 2000);

  if (!displayName) backWithError("name");
  // A birthday must be a real, past calendar date (the input enforces this in
  // the browser; this is the server-side equivalent).
  if (birthdayRaw) {
    const d = new Date(`${birthdayRaw}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(birthdayRaw) ||
      Number.isNaN(d.getTime()) ||
      d.getTime() > Date.now()
    ) {
      backWithError("birthday");
    }
  }

  // Attachment reflection is optional: only score it when every item was
  // actively answered — an untouched form must not produce a "Secure" label.
  const answers: Record<string, number> = {};
  for (const item of ATTACHMENT_ITEMS) {
    const v = Number(formData.get(`att_${item.id}`));
    if (Number.isFinite(v) && v >= 1 && v <= 5) answers[item.id] = v;
  }
  // Skipping the reflection on a later edit must not erase an earlier result
  // (the form can't pre-fill radios from a stored score), so fall back to
  // whatever is already saved.
  const { data: existing } = await supabase
    .from("profiles")
    .select("intake")
    .eq("id", user.id)
    .maybeSingle();
  const prior = (existing?.intake ?? {}) as { attachment?: unknown };
  const attachment =
    Object.keys(answers).length === ATTACHMENT_ITEMS.length
      ? scoreAttachment(answers)
      : (prior.attachment ?? null);
  const intake = { goals, values, attachment } as unknown as Json;

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      birthday: birthdayRaw || null,
      intake,
    })
    .eq("id", user.id);
  if (error) backWithError("save");

  revalidatePath("/account");
  revalidatePath("/", "layout");
  redirect(next);
}

// The lightweight version for invitees who skipped /onboarding: just a name,
// saved from wherever they are (the connection page nudge).
export async function setDisplayName(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const next = safeNextPath(String(formData.get("next") || ""), "/connections");
  const displayName = String(formData.get("display_name") || "")
    .trim()
    .slice(0, 80);
  if (!displayName) redirect(`${next}?error=name`);

  await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  revalidatePath(next);
  const sep = next.includes("?") ? "&" : "?";
  redirect(`${next}${sep}notice=named`);
}

// Same as setDisplayName, without navigating: used on the question pages,
// where a reload would throw away answers that are being typed.
export async function saveDisplayNameInline(
  raw: string,
): Promise<{ error?: string; name?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };

  const displayName = String(raw ?? "").trim().slice(0, 80);
  if (!displayName) return { error: "Please enter a name first." };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);
  if (error) return { error: "Couldn't save that just now. Try again in a moment." };

  revalidatePath("/connections", "layout");
  return { name: displayName };
}

// Account → Notifications. Checkboxes arrive only when checked, so every
// known kind is written explicitly (unchecked = false). Merged into the
// user's own preferences blob under RLS; no other key is touched.
export async function updateNotificationPrefs(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const { data: existing } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .maybeSingle();

  const next = withNotificationPrefs(existing?.preferences ?? {}, {
    your_turn: formData.get("your_turn") === "on",
    revealed: formData.get("revealed") === "on",
    daily_ready: formData.get("daily_ready") === "on",
    discussion_reply: formData.get("discussion_reply") === "on",
  }) as unknown as Json;

  const { error } = await supabase
    .from("profiles")
    .update({ preferences: next })
    .eq("id", user.id);
  if (error) redirect("/account?error=prefs");

  revalidatePath("/account");
  redirect("/account?saved=notifications");
}
