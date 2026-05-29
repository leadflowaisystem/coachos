/**
 * POST /api/orgs/[orgId]/bookings/simulate
 *
 * Dev-only endpoint. Returns 403 in production.
 *
 * Inserts a booking row and emits booking.created exactly as the Cal.com
 * webhook does, so on-booking-created runs identically in local dev
 * without needing a public tunnel.
 *
 * Body: { leadId, startsAt, attendeeName?, attendeeEmail? }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";

interface Params { params: { orgId: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
  return await _POST(req, params);
  } catch (err) {
    console.error("[simulate/booking] unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function _POST(req: NextRequest, params: { orgId: string }) {
  // Hard block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Simulate endpoint is not available in production." },
      { status: 403 }
    );
  }

  // Auth check
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { leadId, startsAt, attendeeName, attendeeEmail } = body as {
    leadId?:        string;
    startsAt?:      string;
    attendeeName?:  string;
    attendeeEmail?: string;
  };

  if (!leadId)  return NextResponse.json({ error: "leadId required" },  { status: 400 });
  if (!startsAt) return NextResponse.json({ error: "startsAt required" }, { status: 400 });

  const orgId = params.orgId;
  const svc   = createServiceClient();
  const now   = new Date().toISOString();

  // Verify lead belongs to this org
  const { data: leadRow } = await svc
    .from("leads")
    .select("id, name")
    .eq("id", leadId)
    .eq("org_id", orgId)
    .single();

  if (!leadRow) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Find the most recent conversation for this lead
  const { data: convRow } = await svc
    .from("conversations")
    .select("id")
    .eq("org_id", orgId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const conversationId = (convRow as { id: string } | null)?.id ?? null;

  // End time = start + 30 min
  const endsAt = new Date(new Date(startsAt).getTime() + 30 * 60 * 1000).toISOString();

  // Insert the booking row
  const { data: booking, error: bookingErr } = await svc
    .from("bookings")
    .insert({
      org_id:          orgId,
      lead_id:         leadId,
      conversation_id: conversationId,
      cal_booking_uid: `sim_${Date.now()}`,
      attendee_name:   attendeeName  || (leadRow as { name: string | null }).name || null,
      attendee_email:  attendeeEmail || null,
      meeting_url:     null,
      status:          "confirmed",
      starts_at:       startsAt,
      ends_at:         endsAt,
      updated_at:      now,
    })
    .select("id")
    .single();

  if (bookingErr || !booking) {
    console.error("[simulate] insert booking failed:", bookingErr?.message);
    return NextResponse.json(
      { error: bookingErr?.message ?? "Failed to create booking" },
      { status: 500 }
    );
  }

  // Advance lead to 'booked'
  await svc.from("leads").update({
    stage:      "booked",
    updated_at: now,
  }).eq("id", leadId);

  // Emit exactly the same event the real Cal.com webhook emits
  await inngest.send({
    name: "booking.created",
    data: {
      orgId,
      bookingId:      (booking as { id: string }).id,
      leadId,
      conversationId,
      startsAt,
    },
  });

  console.log(
    `[simulate] booking ${(booking as { id: string }).id} created for lead ${leadId}`,
    conversationId ? `(conv: ${conversationId})` : "(no conversation)"
  );

  return NextResponse.json({
    ok:             true,
    bookingId:      (booking as { id: string }).id,
    conversationId,
  });
}
