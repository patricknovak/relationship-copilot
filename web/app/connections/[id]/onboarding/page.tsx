import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PromptInstanceView from "@/components/PromptInstanceView";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: instance } = await supabase
    .from("prompt_instances")
    .select("id")
    .eq("connection_id", id)
    .eq("kind", "onboarding")
    .maybeSingle();
  if (!instance) redirect(`/connections/${id}`);

  return (
    <PromptInstanceView
      connectionId={id}
      instanceId={instance.id}
      title="The first 20 questions"
    />
  );
}
