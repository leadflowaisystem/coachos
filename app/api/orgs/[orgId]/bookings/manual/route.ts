/**
 * POST /api/orgs/[orgId]/bookings/manual
 * Logs a manually-created booking (coach records a call that happened outside automation).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";
import { getAccessState } from "@/lib/access";
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

const Schema = z.object({
  lead_id:     z.string().uuid(),
  starts_at:   z.string().datetime(),
  meeting_url: z.string().url().optional().or(z.literal("")),
  notes:       z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const user = await assertMember(params.orgId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessState(params.orgId);
  if (!access.canUseManualBookingPayment) {
    return NextResponse.json({ error: "Manual booking requires Starter plan or above." }, { status: 403 });
  }

  const raw    = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { lead_id, starts_at, meeting_url, notes } = parsed.data;
  const now = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any;

  // Load lead name for attendee_name
  const { data: leadRow } = await svc.from("leads").select("name").eq("id", lead_id).eq("org_id", params.orgId).single();
  if (!leadRow) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  const lead = leadRow as { name: string | null };

  // Calculate ends_at (1 hour after starts_at)
  const ends_at = new Date(new Date(starts_at).getTime() + 60 * 60 * 1000).toISOString();

  const { data: booking, error } = await svc.from("bookings").insert({
    org_id:        params.orgId,
    lead_id,
    status:        "confirmed",
    starts_at,
    ends_at,
    meeting_url:   meeting_url || null,
    attendee_name: lead.name,
    notes:         notes || null,
    source:        "manual",
    created_at:    now,
    updated_at:    now,
  }).select("id, starts_at").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const b = booking as { id: string; starts_at: string };

  // Load lead's conversation (if any) to fire confirm-message
  const { data: convRow } = await svc.from("conversations")
    .select("id").eq("org_id", params.orgId).eq("lead_id", lead_id)
    .order("created_at", { ascending: false }).limit(1).single();
  const conversationId = (convRow as { id: string } | null)?.id ?? null;

  // Fire Inngest events
  await inngest.send([
    {
      name: "booking.confirm-message",
      data: { orgId: params.orgId, bookingId: b.id },
    },
    {
      name: "booking.created",
      data: {
        orgId: params.orgId,
        bookingId: b.id,
        leadId: lead_id,
        conversationId,
        startsAt: b.starts_at,
      },
    },
  ]);

  return NextResponse.json({ booking_id: b.id });
}
