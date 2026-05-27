import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Org } from "@/types/database";

interface Props {
  params: { orgSlug: string };
}

export async function generateMetadata({ params }: Props) {
  return { title: `${params.orgSlug} — CoachOS` };
}

export default async function OrgDashboardPage({ params }: Props) {
  const supabase = createClient();

  const { data } = await supabase
    .from("orgs")
    .select("*")
    .eq("slug", params.orgSlug)
    .single();

  const org = data as Org | null;
  if (!org) notFound();

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold">{org.name}</h2>
      <p className="text-sm text-muted-foreground">
        Dashboard coming in Phase 1. Foundation is live.
      </p>
      <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
        {JSON.stringify({ plan: org.plan, channel: org.active_channel }, null, 2)}
      </pre>
    </div>
  );
}
