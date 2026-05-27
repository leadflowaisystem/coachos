/**
 * /org/[slug]/inbox/[convId]
 * Server component — loads thread data, renders ThreadView client component.
 */

import { redirect, notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ThreadView }  from "@/components/inbox/thread-view";
import type { InboxMessage, InboxDraft, InboxLead } from "@/types/inbox";
import type { LeadStage } from "@/types/database";

interface Props {
  params: { orgSlug: string; convId: string };
}

export async function generateMetadata({ params }: Props) {
  return { title: `Conversation — CoachOS` };
}

export default async function ConversationPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get org ID
  const { data: orgRow } = await supabase
    .from("orgs").select("id")
    .eq("slug", params.orgSlug).single();

  const org = orgRow as { id: string } | null;
  if (!org) notFound();

  const svc = createServiceClient();

  const [convRes, msgRes, draftRes] = await Promise.all([
    svc.from("conversations")
       .select(`id, channel_provider, last_message_at,
                lead:leads (id, name, external_id, channel, score, stage, avatar_url, created_at)`)
       .eq("id", params.convId).eq("org_id", org.id).single(),
    svc.from("messages")
       .select("id, direction, content, sent_at, metadata")
       .eq("conversation_id", params.convId).eq("org_id", org.id)
       .order("sent_at", { ascending: true }),
    svc.from("ai_drafts")
       .select("id, content, status, edited_content, created_at")
       .eq("conversation_id", params.convId).eq("org_id", org.id)
       .eq("status", "pending")
       .order("created_at", { ascending: false })
       .limit(1).maybeSingle(),
  ]);

  if (!convRes.data) notFound();

  const leadRaw = (convRes.data.lead as unknown) as {
    id: string; name: string | null; external_id: string; channel: string;
    score: number; stage: string; avatar_url: string | null; created_at: string;
  } | null;

  const lead: InboxLead | null = leadRaw
    ? { ...leadRaw, stage: leadRaw.stage as LeadStage }
    : null;

  const messages: InboxMessage[] = (msgRes.data ?? []).map((m) => ({
    id:        m.id,
    direction: m.direction as "inbound" | "outbound",
    content:   m.content,
    sent_at:   m.sent_at,
    metadata:  m.metadata as InboxMessage["metadata"],
  }));

  const draft  = draftRes.data as InboxDraft | null;

  return (
    <ThreadView
      orgId={org.id}
      convId={params.convId}
      lead={lead}
      initialMessages={messages}
      initialDraft={draft}
    />
  );
}
