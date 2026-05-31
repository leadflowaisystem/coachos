/**
 * GET  /api/orgs/[orgId]/leads   — paginated CRM list
 * POST /api/orgs/[orgId]/leads   — create lead manually
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sanitizeText } from "@/lib/sanitize";
import { z } from "zod";

interface Params { params: { orgId: string } }

async function assertMember(orgId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("org_members").select("role")
    .eq("org_id", orgId).eq("user_id", user.id).single();
  return data ? user : null;
}

export async function GET(req: NextRequest, { params }: Params) {
  const user = await assertMember(params.orgId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp      = req.nextUrl.searchParams;
  const cursor  = sp.get("cursor");
  const limit   = Math.min(Number(sp.get("limit") ?? 50), 100);
  const search  = sp.get("search") ?? "";
  const stage   = sp.get("stage") ?? "";
  const tag     = sp.get("tag")   ?? "";

  const svc = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = svc
    .from("leads")
    .select("id, name, external_id, channel, score, stage, tags, notes, ltv_inr, last_seen_at, created_at, source, avatar_url")
    .eq("org_id", params.orgId)
    .is("deleted_at", null)
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(limit + 1);

  if (cursor)  query = query.lt("last_seen_at", cursor);
  if (stage)   query = query.eq("stage", stage);
  if (search)  query = query.ilike("name", `%${search}%`);
  if (tag)     query = query.contains("tags", [tag]);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows       = data ?? [];
  const hasMore    = rows.length > limit;
  const items      = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.last_seen_at ?? null : null;

  return NextResponse.json({ leads: items, next_cursor: nextCursor });
}

const CreateSchema = z.object({
  name:         z.string().min(1).max(200),
  handle:       z.string().max(100).optional(),
  email:        z.string().email().optional().or(z.literal("")),
  channel:      z.string().max(50).optional(),
  stage:        z.string().max(30).optional(),
  score:        z.number().min(0).max(100).optional(),
  tags:         z.array(z.string()).optional(),
  notes:        z.string().max(5000).optional(),
  firstMessage: z.string().max(2000).optional(),
  context:      z.string().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const user = await assertMember(params.orgId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw    = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { name, handle, email, channel, stage, score, tags, notes } = parsed.data;
  const now = new Date().toISOString();
  // Cast to any — tags/notes/ltv_inr added in migration 012, not yet in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any;

  const externalId = sanitizeText(handle ?? name).toLowerCase().replace(/\s+/g, "_").replace(/^@/, "");

  const { data: lead, error } = await svc.from("leads").insert({
    org_id:      params.orgId,
    name:        sanitizeText(name),
    external_id: externalId,
    channel:     channel ?? "manual",
    stage:       stage   ?? "cold",
    score:       score   ?? 0,
    source:      "manual",
    tags:        tags    ?? [],
    notes:       sanitizeText(notes) || null,
    metadata:    email ? { email } : {},
    last_seen_at: now,
    updated_at:   now,
  }).select("id, name, stage, score").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const newLead = lead as { id: string; name: string | null; stage: string; score: number };

  // ── Auto-create conversation so lead appears in /inbox immediately ──
  let conversationId: string | null = null;
  try {
    const { data: conv } = await svc.from("conversations").insert({
      org_id:               params.orgId,
      lead_id:              newLead.id,
      channel_provider:     "manual_crm",
      status:               "active",
      last_message_at:      now,
      last_message_preview: "",
    }).select("id").single();
    conversationId = (conv as { id: string } | null)?.id ?? null;

    if (conversationId) {
      await svc.from("messages").insert({
        conversation_id: conversationId,
        org_id:          params.orgId,
        direction:       "system",
        content:         "Lead added via CRM.",
        sent_at:         now,
        metadata:        { source: "crm" },
      });
    }
  } catch { /* non-fatal — lead is created, conversation auto-create best-effort */ }

  return NextResponse.json({ lead: newLead, conversation_id: conversationId });
}
