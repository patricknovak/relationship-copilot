import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PromptInstanceView from "@/components/PromptInstanceView";

const TITLES: Record<string, string> = {
  onboarding: "The first 20 questions",
  daily: "Today's question",
  quiz: "Quiz",
  challenge: "Challenge",
};

export default async function PromptPage({
  params,
}: {
  params: Promise<{ id: string; instanceId: string }>;
}) {
  const { id, instanceId } = await params;
  const supabase = await createClient();

  // Confirm the instance belongs to this connection (RLS already scopes reads).
  const { data: instance } = await supabase
    .from("prompt_instances")
    .select("id, kind, connection_id")
    .eq("id", instanceId)
    .maybeSingle();
  if (!instance || instance.connection_id !== id) {
    redirect(`/connections/${id}`);
  }

  return (
    <PromptInstanceView
      connectionId={id}
      instanceId={instance.id}
      title={TITLES[instance.kind] ?? "Question"}
    />
  );
}
