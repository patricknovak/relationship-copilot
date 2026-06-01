"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ATTACHMENT_ITEMS, scoreAttachment } from "@/lib/attachment";
import type { Json } from "@/lib/database.types";

export async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const displayName = String(formData.get("display_name") || "").trim();
  const birthdayRaw = String(formData.get("birthday") || "").trim();
  const goals = String(formData.get("goals") || "").trim();
  const values = String(formData.get("values") || "").trim();

  if (!displayName) throw new Error("Please tell us your name.");

  const answers: Record<string, number> = {};
  for (const item of ATTACHMENT_ITEMS) {
    const v = Number(formData.get(`att_${item.id}`));
    if (Number.isFinite(v)) answers[item.id] = v;
  }
  const attachment = scoreAttachment(answers);
  const intake = { goals, values, attachment } as unknown as Json;

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      birthday: birthdayRaw || null,
      intake,
    })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/account");
  redirect("/account");
}
