"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/redirect";
import { ATTACHMENT_ITEMS, scoreAttachment } from "@/lib/attachment";
import type { Json } from "@/lib/database.types";

export async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  // Where to land after saving (e.g. back to the connection an invitee came
  // from). Validated to a same-origin path.
  const next = safeNextPath(String(formData.get("next") || ""), "/account");
  const backWithError = (code: string): never =>
    redirect(`/onboarding?error=${code}&next=${encodeURIComponent(next)}`);

  const displayName = String(formData.get("display_name") || "").trim();
  const birthdayRaw = String(formData.get("birthday") || "").trim();
  const goals = String(formData.get("goals") || "").trim();
  const values = String(formData.get("values") || "").trim();

  if (!displayName) backWithError("name");

  // Attachment reflection is optional: only score it when every item was
  // actively answered — an untouched form must not produce a "Secure" label.
  const answers: Record<string, number> = {};
  for (const item of ATTACHMENT_ITEMS) {
    const v = Number(formData.get(`att_${item.id}`));
    if (Number.isFinite(v) && v >= 1 && v <= 5) answers[item.id] = v;
  }
  const attachment =
    Object.keys(answers).length === ATTACHMENT_ITEMS.length
      ? scoreAttachment(answers)
      : null;
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
  redirect(next);
}
