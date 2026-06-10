"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import {
  CONNECTION_TYPES,
  FREE_CONNECTION_CAP,
} from "@/lib/relationships";
import type { ConnectionType } from "@/lib/database.types";

function newInviteCode(): string {
  return randomBytes(9)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();
}

// Create a connection, add the creator as a member, and hand back an invite
// link. Free users are capped; premium is unlimited.
export async function createConnection(formData: FormData) {
  const type = String(formData.get("type") || "") as ConnectionType;
  if (!CONNECTION_TYPES.some((t) => t.value === type)) {
    throw new Error("Please choose a relationship type.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isPremium } = await supabase.rpc("has_premium", {
    uid: user.id,
  });
  if (!isPremium) {
    const { count } = await supabase
      .from("connection_members")
      .select("connection_id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) >= FREE_CONNECTION_CAP) {
      throw new Error(
        `Free plan allows up to ${FREE_CONNECTION_CAP} connections. Upgrade to add more.`,
      );
    }
  }

  const { data: conn, error } = await supabase
    .from("connections")
    .insert({ type, created_by: user.id, invite_code: newInviteCode() })
    .select("id")
    .single();
  if (error || !conn) {
    throw new Error(error?.message ?? "Could not create connection.");
  }

  const { error: memErr } = await supabase.from("connection_members").insert({
    connection_id: conn.id,
    user_id: user.id,
    role: "creator",
    joined_at: new Date().toISOString(),
  });
  if (memErr) throw new Error(memErr.message);

  await logAudit(user.id, "connection.create", conn.id);
  revalidatePath("/connections");
  redirect(`/connections/${conn.id}`);
}

// Leave a connection — archives it (reversible-friendly, and required for the
// teen-revocable parent–teen track). RLS allows members to update.
export async function leaveConnection(connectionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("connections")
    .update({ status: "archived" })
    .eq("id", connectionId);
  if (error) throw new Error(error.message);

  await logAudit(user.id, "connection.archive", connectionId);
  revalidatePath("/connections");
  redirect("/connections");
}

// Accept an invite via the SECURITY DEFINER RPC, then land on the connection.
export async function acceptInvite(code: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/invite/${code}`);

  const { data, error } = await supabase.rpc("accept_invite", {
    p_code: code,
  });
  if (error) throw new Error(error.message);

  await logAudit(user.id, "connection.join", data);
  revalidatePath("/connections");
  redirect(`/connections/${data}`);
}
