/**
 * POST /api/orgs/[orgId]/dashboard/seed
 * Dev-only (403 in production).
 *
 * Inserts ~30 realistic leads with bookings, payments, sequence_runs,
 * and 30 days of metrics_daily so the dashboard renders fully populated.
 *
 * Safe to call multiple times — deletes existing seed data first
 * (rows tagged metadata->seed = true).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

interface Params { params: { orgId: string } }

const SOURCES  = ["reel", "bio_link", "campaign_a", "referral", "organic"];
const CHANNELS = ["instagram", "instagram", "instagram", "whatsapp"];
const NAMES = [
  "Priya Sharma","Ankit Verma","Meera Nair","Rahul Gupta","Divya Patel",
  "Arjun Singh","Kavya Reddy","Siddharth Joshi","Anjali Mehta","Nikhil Kumar",
  "Pooja Iyer","Rohan Das","Sneha Pillai","Vikram Rao","Lakshmi Krishnan",
  "Aditya Bhatt","Riya Malhotra","Kiran Desai","Suresh Nambiar","Nisha Tiwari",
  "Manish Agarwal","Shreya Bose","Tarun Mishra","Deepika Choudhary","Ajay Pandey",
  "Swati Saxena","Rohit Bansal","Geeta Sharma","Praveen Kumar","Asha Menon",
];

export async function POST(_req: NextRequest, { params }: Params) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members").select("role")
    .eq("org_id", params.orgId).eq("user_id", user.id).single();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc   = createServiceClient();
  const orgId = params.orgId;

  // ── 1. Clean up previous seed data ──────────────────────────
  // Find seed leads first so we can cascade-delete their conversations
  const { data: seedLeads } = await svc.from("leads")
    .select("id").eq("org_id", orgId).contains("metadata", { seed: true });
  const seedLeadIds = (seedLeads ?? []).map((l) => (l as { id: string }).id);

  // Delete child rows before leads (FK constraints; conversations cascade from leads)
  await Promise.all([
    svc.from("metrics_daily").delete().eq("org_id", orgId),
    svc.from("messages").delete().eq("org_id", orgId)
      .contains("metadata", { seed: true }),
    ...(seedLeadIds.length > 0
      ? [
          svc.from("sequence_runs").delete().in("lead_id", seedLeadIds),
          svc.from("payments").delete().in("lead_id", seedLeadIds),
          svc.from("bookings").delete().in("lead_id", seedLeadIds),
        ]
      : []),
  ]);

  if (seedLeadIds.length > 0) {
    // Conversations cascade-delete from leads
    await svc.from("leads").delete().in("id", seedLeadIds);
  }

  // ── 2. Generate 30 days of data ───────────────────────────────
  const now      = Date.now();
  const DAY      = 86400000;
  const totalLeads = 30;

  // Define a realistic conversion funnel distribution
  // 30 leads: 10 cold, 5 warm, 4 hot, 3 booking_sent, 3 booked, 2 qualified, 2 won, 1 paid×30% sample
  const stageDistribution: Array<{
    stage: string; score: number; hasBooking: boolean;
    bookingStatus?: string; hasPayment: boolean; paymentStatus?: string;
    hasDunning: boolean; hasRevival: boolean; paymentDaysAgo?: number;
  }> = [
    // cold leads
    ...Array(6).fill(null).map(() => ({
      stage: "cold", score: rnd(5, 20), hasBooking: false,
      hasPayment: false, hasDunning: false, hasRevival: false,
    })),
    // warm leads
    ...Array(4).fill(null).map(() => ({
      stage: "warm", score: rnd(35, 55), hasBooking: false,
      hasPayment: false, hasDunning: false, hasRevival: false,
    })),
    // hot
    ...Array(3).fill(null).map(() => ({
      stage: "hot", score: rnd(65, 80), hasBooking: false,
      hasPayment: false, hasDunning: false, hasRevival: false,
    })),
    // booked + showed
    { stage: "booked",  score: 72, hasBooking: true, bookingStatus: "confirmed",  hasPayment: false, hasDunning: false, hasRevival: false },
    { stage: "booked",  score: 75, hasBooking: true, bookingStatus: "confirmed",  hasPayment: false, hasDunning: false, hasRevival: false },
    { stage: "qualified",score:82, hasBooking: true, bookingStatus: "completed",  hasPayment: false, hasDunning: false, hasRevival: false },
    // no-show recovery → paid
    { stage: "won", score: 88, hasBooking: true, bookingStatus: "no_show", hasPayment: true, paymentStatus: "paid", hasDunning: false, hasRevival: false, paymentDaysAgo: 5 },
    { stage: "won", score: 84, hasBooking: true, bookingStatus: "no_show", hasPayment: true, paymentStatus: "paid", hasDunning: false, hasRevival: false, paymentDaysAgo: 8 },
    // dunning wins
    { stage: "won", score: 90, hasBooking: true, bookingStatus: "completed", hasPayment: true, paymentStatus: "paid", hasDunning: true,  hasRevival: false, paymentDaysAgo: 3 },
    { stage: "won", score: 86, hasBooking: true, bookingStatus: "completed", hasPayment: true, paymentStatus: "paid", hasDunning: true,  hasRevival: false, paymentDaysAgo: 6 },
    { stage: "won", score: 91, hasBooking: true, bookingStatus: "completed", hasPayment: true, paymentStatus: "paid", hasDunning: true,  hasRevival: false, paymentDaysAgo: 12 },
    // revival wins
    { stage: "won", score: 78, hasBooking: false, hasPayment: true, paymentStatus: "paid", hasDunning: false, hasRevival: true, paymentDaysAgo: 7 },
    { stage: "won", score: 82, hasBooking: false, hasPayment: true, paymentStatus: "paid", hasDunning: false, hasRevival: true, paymentDaysAgo: 14 },
    // clean paid
    { stage: "paid", score: 95, hasBooking: true, bookingStatus: "completed", hasPayment: true, paymentStatus: "paid", hasDunning: false, hasRevival: false, paymentDaysAgo: 2 },
    { stage: "paid", score: 93, hasBooking: true, bookingStatus: "completed", hasPayment: true, paymentStatus: "paid", hasDunning: false, hasRevival: false, paymentDaysAgo: 9 },
    { stage: "paid", score: 92, hasBooking: true, bookingStatus: "completed", hasPayment: true, paymentStatus: "paid", hasDunning: false, hasRevival: false, paymentDaysAgo: 15 },
    { stage: "paid", score: 94, hasBooking: true, bookingStatus: "completed", hasPayment: true, paymentStatus: "paid", hasDunning: false, hasRevival: false, paymentDaysAgo: 21 },
    // pending payments (active dunning)
    { stage: "booked", score: 80, hasBooking: true, bookingStatus: "completed", hasPayment: true, paymentStatus: "pending", hasDunning: true, hasRevival: false },
    { stage: "booked", score: 77, hasBooking: true, bookingStatus: "completed", hasPayment: true, paymentStatus: "pending", hasDunning: false, hasRevival: false },
    // ghost leads (inactive, revival candidates)
    { stage: "warm", score: 45, hasBooking: false, hasPayment: false, hasDunning: false, hasRevival: true },
  ];

  const shuffledNames = [...NAMES].sort(() => Math.random() - 0.5);
  const inserted: { leads: number; bookings: number; payments: number; sequences: number } =
    { leads: 0, bookings: 0, payments: 0, sequences: 0 };
  const insertedLeadIds: string[]        = [];
  const replyDelaysByLeadId = new Map<string, number>();

  for (let i = 0; i < Math.min(stageDistribution.length, totalLeads); i++) {
    const spec    = stageDistribution[i];
    const name    = shuffledNames[i] ?? `Lead ${i + 1}`;
    const source  = SOURCES[i % SOURCES.length];
    const channel = CHANNELS[i % CHANNELS.length];
    const daysAgo = rnd(1, 29);
    const leadCreatedAt = new Date(now - daysAgo * DAY).toISOString();
    const lastSeen = spec.hasRevival && !spec.hasPayment
      ? new Date(now - rnd(15, 28) * DAY).toISOString()
      : new Date(now - rnd(0, daysAgo) * DAY).toISOString();

    // Insert lead
    const { data: leadRow } = await svc.from("leads").insert({
      org_id:       orgId,
      name,
      channel,
      external_id: `seed_${i}_${Date.now()}`,
      score:        spec.score,
      stage:        spec.stage as "cold" | "warm" | "hot" | "booking_sent" | "booked" | "qualified" | "won" | "paid" | "churned",
      source,
      last_seen_at: lastSeen,
      created_at:   leadCreatedAt,
      updated_at:   leadCreatedAt,
      metadata:     { seed: true },
    }).select("id").single();

    if (!leadRow) continue;
    const leadId = (leadRow as { id: string }).id;
    inserted.leads++;
    insertedLeadIds.push(leadId);

    // Insert conversation + messages
    const { data: convRow } = await svc.from("conversations").insert({
      org_id:               orgId,
      lead_id:              leadId,
      channel_provider:     channel,
      last_message_at:      lastSeen,
      last_message_preview: "Hey, I'm interested in your coaching program",
      created_at:           leadCreatedAt,
    }).select("id").single();

    const convId = convRow ? (convRow as { id: string }).id : null;

    if (convId) {
      const replyDelay = rnd(2, 45) * 60 * 1000; // 2–45 min speed-to-lead
      replyDelaysByLeadId.set(leadId, replyDelay);
      await svc.from("messages").insert([
        {
          conversation_id: convId,
          org_id: orgId,
          direction: "inbound" as const,
          content: "Hey, I'm interested in your coaching program! Can you tell me more?",
          sent_at: leadCreatedAt,
          metadata: { seed: true } as unknown as Json,
        },
        {
          conversation_id: convId,
          org_id: orgId,
          direction: "outbound" as const,
          content: "Hi! I'd love to help you. Let me share what we offer...",
          sent_at: new Date(new Date(leadCreatedAt).getTime() + replyDelay).toISOString(),
          metadata: { seed: true, reply_delay_ms: replyDelay } as unknown as Json,
        },
      ]);
    }

    // Booking
    let bookingId: string | null = null;
    if (spec.hasBooking && convId) {
      const bookingDaysAgo = rnd(1, Math.min(daysAgo, 20));
      const startsAt = new Date(now - bookingDaysAgo * DAY).toISOString();
      const { data: bookingRow } = await svc.from("bookings").insert({
        org_id:          orgId,
        lead_id:         leadId,
        conversation_id: convId,
        status:          (spec.bookingStatus ?? "confirmed") as "pending" | "confirmed" | "completed" | "no_show" | "cancelled",
        starts_at:       startsAt,
        ends_at:         new Date(new Date(startsAt).getTime() + 3600000).toISOString(),
        attendee_name:   name,
        attendee_email:  `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        cal_booking_uid: `seed_${i}_${Date.now()}`,
        recovery_attempt: 0,
        created_at:      new Date(now - (bookingDaysAgo + 1) * DAY).toISOString(),
        updated_at:      startsAt,
      }).select("id").single();
      if (bookingRow) {
        bookingId = (bookingRow as { id: string }).id;
        inserted.bookings++;
      }
    }

    // Payment
    let paymentId: string | null = null;
    if (spec.hasPayment && convId) {
      const amounts = [15000, 25000, 35000, 50000, 75000, 20000, 45000];
      const amountInr = amounts[i % amounts.length];
      const payDaysAgo = spec.paymentDaysAgo ?? rnd(1, daysAgo);
      const paidAt = new Date(now - payDaysAgo * DAY).toISOString();

      const { data: payRow } = await svc.from("payments").insert({
        org_id:           orgId,
        lead_id:          leadId,
        conversation_id:  convId,
        amount_inr:       amountInr,
        status:           (spec.paymentStatus ?? "pending") as "paid" | "pending" | "failed" | "refunded",
        payment_link_id:  `seed_plink_${i}`,
        payment_link_url: `https://rzp.io/l/seed_${i}`,
        created_at:       new Date(now - (payDaysAgo + 1) * DAY).toISOString(),
        updated_at:       paidAt,
      }).select("id").single();

      if (payRow) {
        paymentId = (payRow as { id: string }).id;
        inserted.payments++;
      }
    }

    // Sequence run
    if ((spec.hasDunning || spec.hasRevival) && convId) {
      const seqType   = spec.hasDunning ? "dunning" : "ghost_revival";
      const seqStatus = spec.hasPayment && spec.paymentStatus === "paid" ? "completed" : "active";
      const stepCurrent = seqStatus === "completed" ? rnd(1, 3) : rnd(0, 2);
      const seqDaysAgo = rnd(1, Math.min(daysAgo, 15));

      await svc.from("sequence_runs").insert({
        org_id:          orgId,
        lead_id:         leadId,
        conversation_id: convId,
        type:            seqType,
        status:          seqStatus,
        step_current:    stepCurrent,
        step_total:      3,
        metadata:        ({
          seed: true,
          ...(paymentId ? { payment_id: paymentId } : {}),
          ...(seqType === "ghost_revival" ? { inactive_days: rnd(14, 28) } : {}),
        }) as unknown as Json,
        started_at: new Date(now - seqDaysAgo * DAY).toISOString(),
        updated_at: new Date(now - rnd(0, seqDaysAgo) * DAY).toISOString(),
        ...(seqStatus === "completed" ? { stopped_at: new Date(now - rnd(0, 3) * DAY).toISOString() } : {}),
      });
      inserted.sequences++;
    }
  }

  // ── 3. Seed 30 days of metrics_daily ────────────────────────
  // Re-query all inserted data to compute realistic daily metrics
  const [allLeads, allPayments, allBookings, allSeqRuns, allConvs] = await Promise.all([
    // leads: metadata col exists — safe to use contains
    svc.from("leads").select("id, score, stage, source, created_at, last_seen_at")
      .eq("org_id", orgId).contains("metadata", { seed: true }),
    // payments/bookings/convs have no metadata col — filter by inserted lead IDs
    svc.from("payments").select("id, amount_inr, status, lead_id, updated_at")
      .eq("org_id", orgId).in("lead_id", insertedLeadIds),
    svc.from("bookings").select("id, status, lead_id, created_at, updated_at")
      .eq("org_id", orgId).in("lead_id", insertedLeadIds),
    svc.from("sequence_runs").select("id, type, status, lead_id")
      .eq("org_id", orgId).in("lead_id", insertedLeadIds),
    svc.from("conversations").select("id, lead_id, created_at")
      .eq("org_id", orgId).in("lead_id", insertedLeadIds),
  ]);

  type LeadR   = { id: string; score: number; stage: string; source: string | null; created_at: string };
  type PayR    = { id: string; amount_inr: number; status: string; lead_id: string; updated_at: string };
  type BookR   = { id: string; status: string; lead_id: string; created_at: string; updated_at: string };
  type SeqR    = { id: string; type: string; status: string; lead_id: string };
  type ConvR   = { id: string; lead_id: string; created_at: string };

  const leads_   = (allLeads.data   ?? []) as LeadR[];
  const pays_    = (allPayments.data ?? []) as PayR[];
  const books_   = (allBookings.data ?? []) as BookR[];
  const seqs_    = (allSeqRuns.data  ?? []) as SeqR[];
  const convs_   = (allConvs.data    ?? []) as ConvR[];

  const dunnLeads   = new Set(seqs_.filter((s) => s.type === "dunning").map((s) => s.lead_id));
  const revLeads    = new Set(seqs_.filter((s) => s.type === "ghost_revival").map((s) => s.lead_id));
  const noshowLeads = new Set(books_.filter((b) => b.status === "no_show").map((b) => b.lead_id));
  const leadSource  = Object.fromEntries(leads_.map((l) => [l.id, l.source ?? "organic"]));

  const metricRows = [];
  for (let d = 29; d >= 0; d--) {
    const dateMs    = now - d * DAY;
    const dateStr   = new Date(dateMs).toISOString().slice(0, 10);
    const dayStart  = `${dateStr}T00:00:00.000Z`;
    const dayEnd    = `${dateStr}T23:59:59.999Z`;

    const inRange = (iso: string) => iso >= dayStart && iso <= dayEnd;

    const dayConvs   = convs_.filter((c) => inRange(c.created_at));
    const dayQual    = leads_.filter((l) => inRange(l.created_at) && l.score >= 50);
    const dayBooked  = books_.filter((b) => inRange(b.created_at) && b.status === "confirmed");
    const dayShowed  = books_.filter((b) => inRange(b.updated_at) && b.status === "completed");
    const dayPaid    = pays_.filter((p) => inRange(p.updated_at) && p.status === "paid");

    const revenuePaid   = dayPaid.reduce((s, p) => s + p.amount_inr, 0);
    const pipelineInr   = pays_.filter((p) => p.status === "pending")
      .reduce((s, p) => s + p.amount_inr, 0);

    let dunnInr = 0, revInr = 0, noshowInr = 0;
    for (const p of dayPaid) {
      if (dunnLeads.has(p.lead_id))   dunnInr   += p.amount_inr;
      if (revLeads.has(p.lead_id))    revInr    += p.amount_inr;
      if (noshowLeads.has(p.lead_id)) noshowInr += p.amount_inr;
    }

    // Source breakdown for this day
    const srcMap: Record<string, { leads: number; revenue_inr: number }> = {};
    for (const l of leads_.filter((l) => inRange(l.created_at))) {
      const s = l.source ?? "organic";
      if (!srcMap[s]) srcMap[s] = { leads: 0, revenue_inr: 0 };
      srcMap[s].leads++;
    }
    for (const p of dayPaid) {
      const s = leadSource[p.lead_id] ?? "organic";
      if (!srcMap[s]) srcMap[s] = { leads: 0, revenue_inr: 0 };
      srcMap[s].revenue_inr += p.amount_inr;
    }

    metricRows.push({
      org_id:              orgId,
      date:                dateStr,
      dms_received:        dayConvs.length,
      leads_qualified:     dayQual.length,
      leads_booked:        dayBooked.length,
      leads_showed:        dayShowed.length,
      leads_paid:          dayPaid.length,
      revenue_paid_inr:    revenuePaid,
      revenue_dunning_inr: dunnInr,
      revenue_revival_inr: revInr,
      revenue_noshow_inr:  noshowInr,
      pipeline_inr:        pipelineInr,
      speed_sum_ms:        dayConvs.reduce((s, c) => s + (replyDelaysByLeadId.get(c.lead_id) ?? rnd(5, 30) * 60000), 0),
      speed_count:         dayConvs.length,
      messages_ai:         dayConvs.length * rnd(2, 5),
      tokens_used:         dayConvs.length * rnd(800, 2000),
      source_breakdown:    srcMap,
    });
  }

  if (metricRows.length > 0) {
    await svc.from("metrics_daily").upsert(metricRows, { onConflict: "org_id,date" });
  }

  return NextResponse.json({
    ok: true,
    inserted,
    metrics_days: metricRows.length,
  });
}

function rnd(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
