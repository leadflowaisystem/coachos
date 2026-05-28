/**
 * POST /api/orgs/[orgId]/payments/simulate
 * Dev-only (403 in production).
 *
 * Simulates the Razorpay payment lifecycle without a real webhook or public tunnel.
 *
 * action = "create"   — creates a pending payment row, emits payment.created
 * action = "capture"  — marks an existing payment as paid, lead stage = won
 * action = "unpaid"   — directly emits payment.unpaid to trigger dunning immediately
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";

interface Params { params: { orgId: string } }

export async function POST(req: NextRequest, { params }: Params) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action, leadId, amountInr, description, paymentId } = body as {
    action:        "create" | "capture" | "unpaid";
    leadId?:       string;
    amountInr?:    number;
    description?:  string;
    paymentId?:    string;
  };

  const orgId = params.orgId;
  const svc   = createServiceClient();
  const now   = new Date().toISOString();

  // ── CREATE ───────────────────────────────────────────────────
  if (action === "create") {
    if (!leadId)   return NextResponse.json({ error: "leadId required" },   { status: 400 });
    if (!amountInr || amountInr <= 0)
      return NextResponse.json({ error: "amountInr required" }, { status: 400 });

    // Find most recent conversation for lead
    const { data: convRow } = await svc
      .from("conversations")
      .select("id")
      .eq("org_id", orgId)
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const conversationId = (convRow as { id: string } | null)?.id ?? null;
    const fakeUrl = `https://rzp.io/l/sim_${Date.now()}`;

    const { data: payment, error } = await svc.from("payments").insert({
      org_id:           orgId,
      lead_id:          leadId,
      conversation_id:  conversationId,
      amount_inr:       amountInr,
      status:           "pending",
      payment_link_id:  `sim_plink_${Date.now()}`,
      payment_link_url: fakeUrl,
      updated_at:       now,
    }).select("id").single();

    if (error || !payment) {
      return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
    }

    const pid = (payment as { id: string }).id;

    // Send a message to the conversation if available
    if (conversationId) {
      await svc.from("messages").insert({
        conversation_id: conversationId,
        org_id:          orgId,
        direction:       "outbound",
        content:         `[Simulated] Payment link for ${description ?? "the program"} — ₹${amountInr.toLocaleString("en-IN")}:\n${fakeUrl}`,
        sent_at:         now,
        metadata:        { source: "simulate" },
      });
      await svc.from("conversations").update({
        last_message_at:      now,
        last_message_preview: `Payment link — ₹${amountInr.toLocaleString("en-IN")}`,
      }).eq("id", conversationId);
    }

    await inngest.send({
      name: "payment.created",
      data: { orgId, paymentId: pid, leadId, conversationId },
    });

    return NextResponse.json({ ok: true, paymentId: pid, conversationId });
  }

  // ── CAPTURE (mark paid) ──────────────────────────────────────
  if (action === "capture") {
    if (!paymentId) return NextResponse.json({ error: "paymentId required" }, { status: 400 });

    const { data: pm } = await svc
      .from("payments")
      .select("id, lead_id, conversation_id, amount_inr")
      .eq("id", paymentId)
      .eq("org_id", orgId)
      .single();

    if (!pm) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    const p = pm as { id: string; lead_id: string; conversation_id: string | null; amount_inr: number };

    await svc.from("payments").update({
      status:     "paid",
      updated_at: now,
    }).eq("id", paymentId);

    await svc.from("leads").update({
      stage:      "won",
      updated_at: now,
    }).eq("id", p.lead_id);

    await inngest.send({
      name: "payment.captured",
      data: {
        orgId,
        paymentId:      p.id,
        leadId:         p.lead_id,
        conversationId: p.conversation_id,
        amountInr:      p.amount_inr,
      },
    });

    return NextResponse.json({ ok: true });
  }

  // ── UNPAID (trigger dunning immediately) ─────────────────────
  if (action === "unpaid") {
    if (!paymentId) return NextResponse.json({ error: "paymentId required" }, { status: 400 });

    const { data: pm } = await svc
      .from("payments")
      .select("id, lead_id, conversation_id")
      .eq("id", paymentId)
      .eq("org_id", orgId)
      .single();

    if (!pm) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    const p = pm as { id: string; lead_id: string; conversation_id: string | null };

    await inngest.send({
      name: "payment.unpaid",
      data: {
        orgId,
        paymentId:      p.id,
        leadId:         p.lead_id,
        conversationId: p.conversation_id,
      },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
