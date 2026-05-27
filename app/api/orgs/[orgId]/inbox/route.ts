/**
 * GET /api/orgs/[orgId]/inbox
 * Returns a paginated list of conversations with lead info, last message
 * preview, and a flag for pending AI drafts.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

interface Params { params: { orgId: string } }

async function assertMember(orgId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("org_members").select("role")
    .eq("org_id", orgId).eq("user_id", user.id).single();
  return data ? user : null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await assertMember(params.orgId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();

  const { data: convRows, error } = await svc
    .from("conversations")
    .select(`
      id,
      channel_provider,
      last_message_at,
      last_message_preview,
      lead:leads (id, name, external_id, channel, score, stage, avatar_url)
    `)
    .eq("org_id", params.orgId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(60);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const convIds = (convRows ?? []).map((c) => c.id);

  const { data: draftRows } = convIds.length
    ? await svc.from("ai_drafts")
        .select("conversation_id")
        .in("conversation_id", convIds)
        .eq("status", "pending")
    : { data: [] };

  const draftSet = new Set((draftRows ?? []).map((d) => d.conversation_id as string));

  const conversations = (convRows ?? []).map((c) => ({
    ...c,
    hasPendingDraft: draftSet.has(c.id),
  }));

  return NextResponse.json({ conversations });
}
