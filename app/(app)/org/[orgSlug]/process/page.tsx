/**
 * /org/[slug]/process — AI Coach Cockpit: screenshot OCR + batch DM processing.
 * The primary surface after onboarding.
 */

import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ProcessView } from "@/components/process/process-view";

export async function generateMetadata() {
  return { title: "AI Cockpit — CoachOS" };
}

interface Props { params: { orgSlug: string } }

export default async function ProcessPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: orgRow } = await supabase
    .from("orgs").select("id, name, plan, trial_ends_at, monthly_ai_msg_count")
    .eq("slug", params.orgSlug).single();

  if (!orgRow) notFound();

  const org = orgRow as { id: string; name: string; plan: string; trial_ends_at: string | null; monthly_ai_msg_count: number };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-[var(--text)]">AI Cockpit</h1>
        <p className="text-sm text-[var(--text-3)]">
          Upload a screenshot of your DM inbox — CoachOS scores every lead and drafts replies in your voice.
        </p>
      </div>
      <ProcessView orgId={org.id} orgSlug={params.orgSlug} />
    </div>
  );
}
