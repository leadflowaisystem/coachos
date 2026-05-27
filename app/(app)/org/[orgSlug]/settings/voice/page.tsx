import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { VoiceProfileForm } from "./voice-form-client";

export async function generateMetadata() {
  return { title: "Voice profile — CoachOS" };
}

export default async function VoiceSettingsPage({
  params,
}: {
  params: { orgSlug: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: orgData } = await supabase
    .from("orgs")
    .select("id, name")
    .eq("slug", params.orgSlug)
    .single();

  const org = orgData as { id: string; name: string } | null;
  if (!org) notFound();

  // Load existing voice profile
  const service = createServiceClient();
  const { data: voiceData } = await service
    .from("voice_profiles")
    .select("*")
    .eq("org_id", org.id)
    .single();

  const voice = voiceData as {
    tone: string;
    offer: string;
    price_range: string;
    sells: string;
    objections: string[];
    extra_context: string;
  } | null;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-[var(--text)]">
          Voice profile
        </h1>
        <p className="text-sm text-[var(--text-3)] mt-1">
          How the AI speaks as you — for {org.name}.
        </p>
      </div>

      <VoiceProfileForm
        orgId={org.id}
        orgSlug={params.orgSlug}
        initial={voice}
      />
    </div>
  );
}
